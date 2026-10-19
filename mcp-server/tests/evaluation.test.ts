import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadCases,
  parseCase,
  unknownSlugs,
} from '../scripts/evaluation/cases.js';
import { compareReports } from '../scripts/evaluation/compare.js';
import {
  formatComparison,
  formatReport,
} from '../scripts/evaluation/printing.js';
import {
  evaluateCase,
  evaluateClaim,
  scoreToGrade,
  summarize,
} from '../scripts/evaluation/scoring.js';
import { KnowledgeGraph } from '../src/graph/index.js';
import { type JsonLdGraph, JsonLdGraphSchema } from '../src/graph/types.js';

const claim = {
  id: 'C1',
  text: 'A claim',
  good: ['good'],
  acceptable: ['okay'],
  bad: ['bad'],
};
const rubric = {
  schema: 1,
  id: 'sample',
  title: 'Sample',
  system: 'Example system',
  claims: [claim],
};
const metadata = { rankingAvailable: false, semanticUsed: true, elapsedMs: 1 };
const folders: string[] = [];
afterEach(async () => {
  await Promise.all(
    folders
      .splice(0)
      .map((folder) => fs.rm(folder, { recursive: true, force: true }))
  );
});
async function makeFolder() {
  await fs.mkdir('generated', { recursive: true });
  const directory = await fs.mkdtemp(
    path.resolve('generated/evaluation-test-')
  );
  folders.push(directory);
  return directory;
}

describe('case files', () => {
  it('loads a valid case, ignores extra fields and merges repeated labels', async () => {
    const directory = await makeFolder();
    await fs.writeFile(
      path.join(directory, 'sample.rubric.json'),
      JSON.stringify({
        ...rubric,
        provenance: 'ignored',
        claims: [
          {
            ...claim,
            good: ['good', 'good'],
            provenance: true,
            votes: { good: ['good', 'acceptable'] },
          },
        ],
      })
    );
    const loaded = await loadCases(directory);
    expect(loaded[0].claims[0].good).toEqual(['good']);
    expect(loaded[0]).not.toHaveProperty('provenance');
    expect(loaded[0].claims[0]).not.toHaveProperty('provenance');
    expect(loaded[0].claims[0].votes).toEqual({ good: ['good', 'acceptable'] });
  });
  it.each([
    ['filename', { ...rubric, id: 'different' }],
    ['duplicate claim ids', { ...rubric, claims: [claim, claim] }],
    ['empty text', { ...rubric, claims: [{ ...claim, text: '  ' }] }],
    [
      'overlapping labels',
      { ...rubric, claims: [{ ...claim, bad: ['good'] }] },
    ],
    [
      'invalid vote label',
      { ...rubric, claims: [{ ...claim, votes: { good: ['neutral'] } }] },
    ],
    [
      'non-array votes',
      { ...rubric, claims: [{ ...claim, votes: { good: 'good' } }] },
    ],
    ['schema version', { ...rubric, schema: 2 }],
    ['empty case', { ...rubric, claims: [] }],
  ])('rejects %s with the filename', (_, value) => {
    expect(() => parseCase(value, 'sample.rubric.json')).toThrow(
      'sample.rubric.json:'
    );
  });
  it('filters cases and rejects missing selections, empty folders and malformed JSON', async () => {
    const directory = await makeFolder();
    await expect(loadCases(directory)).rejects.toThrow('No case files');
    await fs.writeFile(
      path.join(directory, 'sample.rubric.json'),
      JSON.stringify(rubric)
    );
    await fs.writeFile(
      path.join(directory, 'second.rubric.json'),
      JSON.stringify({ ...rubric, id: 'second' })
    );
    expect(
      (await loadCases(directory, ['second'])).map((item) => item.id)
    ).toEqual(['second']);
    await expect(loadCases(directory, ['missing'])).rejects.toThrow(
      'Unknown case'
    );
    await fs.writeFile(path.join(directory, 'broken.rubric.json'), '{');
    await expect(loadCases(directory)).rejects.toThrow('broken.rubric.json:');
  });
  it('finds unknown label, note and vote slugs against the fixture graph', async () => {
    const graph = new KnowledgeGraph(
      JsonLdGraphSchema.parse(
        JSON.parse(await fs.readFile('tests/fixtures/test-graph.json', 'utf8'))
      ) as JsonLdGraph
    );
    const known = new Set(
      graph.getAllTechniques().map((technique) => technique.slug)
    );
    const value = parseCase(
      {
        ...rubric,
        claims: [
          {
            ...claim,
            good: ['shapley-additive-explanations'],
            notes: { retired: 'old' },
            votes: { voted: ['good'] },
          },
        ],
      },
      'sample.rubric.json'
    );
    expect(unknownSlugs(value, known)).toEqual([
      'bad',
      'okay',
      'retired',
      'voted',
    ]);
  });
});

it('scores all labels, preserves returned order and ignores votes', () => {
  const result = evaluateClaim(
    { ...claim, votes: { bad: ['good'] } },
    ['good', 'okay', 'bad', 'new', 'good'],
    metadata
  );
  expect(result.totalScore).toBe(1);
  expect(result.grade).toBe('B-');
  expect(result.scores.map((item) => item.label)).toEqual([
    'good',
    'acceptable',
    'bad',
    'unlisted',
    'good',
  ]);
  expect(result.labelCounts).toEqual({
    good: 2,
    acceptable: 1,
    bad: 1,
    unlisted: 1,
  });
});
it('preserves every grade boundary', () => {
  expect(
    [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(scoreToGrade)
  ).toEqual([
    'D',
    'C',
    'C',
    'C+',
    'C+',
    'B-',
    'B-',
    'B',
    'B',
    'B+',
    'B+',
    'A-',
    'A-',
    'A',
    'A',
  ]);
});
it('weights overall claims and case averages separately and prints warnings', () => {
  const parsed = parseCase(rubric, 'sample.rubric.json');
  const a = evaluateCase(
    parsed,
    [evaluateClaim(claim, ['good', 'good'], metadata)],
    ['retired']
  );
  const b = evaluateCase(
    { ...parsed, id: 'second' },
    [
      evaluateClaim(claim, [], metadata),
      evaluateClaim({ ...claim, id: 'C2' }, [], metadata),
    ],
    []
  );
  const overall = summarize([a, b]);
  expect(overall).toEqual({
    caseCount: 2,
    claimCount: 3,
    averageScore: 2 / 3,
    averageCaseScore: 1,
  });
  expect(
    formatReport({
      schema: 1,
      timestamp: '',
      config: {
        embeddingModel: 'test',
        querySource: 'in-process',
        rankingEnabled: false,
        dataDirectory: '',
        casesDirectory: '',
      },
      embeddingsLoaded: true,
      cases: [a, b],
      overall,
    })
  ).toContain('WARNING: unknown rubric slug: retired');
});
it('compares shared claims by case and claim id, with explicit missing lists', () => {
  const a = {
    schema: 1,
    cases: [
      {
        id: 'first',
        claims: [
          { id: 'C1', totalScore: 1 },
          { id: 'C2', totalScore: 3 },
          { id: 'old', totalScore: 100 },
        ],
      },
      { id: 'second', claims: [{ id: 'C1', totalScore: -1 }] },
    ],
  };
  const b = {
    schema: 1,
    cases: [
      {
        id: 'first',
        claims: [
          { id: 'C1', totalScore: 3 },
          { id: 'C2', totalScore: 5 },
          { id: 'new', totalScore: -100 },
        ],
      },
      { id: 'second', claims: [{ id: 'C1', totalScore: -1 }] },
    ],
  };
  const comparison = compareReports(a, b);
  expect(comparison.claims.map((item) => item.difference)).toEqual([2, 2, 0]);
  expect(comparison.cases[0]).toEqual({
    id: 'first',
    claimCount: 2,
    scoreA: 2,
    scoreB: 4,
    difference: 2,
  });
  expect(comparison.overall.scoreA).toBe(1);
  expect(comparison.overall.scoreB).toBe(7 / 3);
  expect(comparison.overall.averageCaseScores).toEqual({
    scoreA: 0.5,
    scoreB: 1.5,
    difference: 1,
  });
  expect(comparison.onlyInA).toEqual([{ caseId: 'first', claimId: 'old' }]);
  expect(comparison.onlyInB).toEqual([{ caseId: 'first', claimId: 'new' }]);
  expect(formatComparison(comparison)).toContain('Only in B: first/new');
  expect(() => compareReports(a, { schema: 1, cases: [] })).toThrow(
    'share no claims'
  );
  expect(() => compareReports(a, { schema: 2, cases: [] })).toThrow();
  expect(() =>
    compareReports(a, { ...a, cases: [...a.cases, a.cases[0]] })
  ).toThrow('Duplicate case');
});
