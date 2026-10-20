import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  computeRelated,
  cosineSimilarity,
  generateRelated,
  meanVectors,
  relatedScore,
  weightedJaccard,
} from '../scripts/generate-related.js';

function entry(slug, values) {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, i) => {
    bytes.writeFloatLE(value, i * 4);
  });
  return { slug, vector: bytes.toString('base64') };
}

const embeddingFile = {
  dimensions: 2,
  entries: [entry('a', [1, 0]), entry('a', [0, 1]), entry('b', [1, 0])],
};

test('weighted Jaccard weights goals, ignores the explicit zero-weight tags and deduplicates', () => {
  assert.equal(
    weightedJaccard(
      [
        'assurance-goal-category/fairness',
        'data-type/any',
        'assurance-goal-category/general',
        'x',
        'x',
      ],
      ['assurance-goal-category/fairness', 'y']
    ),
    2 / 4
  );
  assert.equal(weightedJaccard(['data-type/any'], ['data-type/any']), 0);
  assert.equal(weightedJaccard([], []), 0);
});

test('cosine uses the normalised mean of all entries per technique', () => {
  const vectors = meanVectors(embeddingFile);
  const a = vectors.get('a');
  assert.ok(Math.abs(a[0] - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(a[1] - Math.SQRT1_2) < 1e-12);
  assert.ok(
    Math.abs(cosineSimilarity(a, vectors.get('b')) - Math.SQRT1_2) < 1e-12
  );
  assert.ok(
    Math.abs(
      relatedScore(
        { slug: 'a', tags: ['x'] },
        { slug: 'b', tags: ['x'] },
        vectors
      ) -
        (0.5 + 0.5 * Math.SQRT1_2)
    ) < 1e-12
  );
});

test('a missing vector uses tags alone in either direction', () => {
  const vectors = meanVectors(embeddingFile);
  const a = { slug: 'a', tags: ['x', 'y'] };
  const missing = { slug: 'new', tags: ['x'] };
  assert.equal(relatedScore(a, missing, vectors), 0.5);
  assert.equal(relatedScore(missing, a, vectors), 0.5);
});

test('top three exclude self, rank by score then slug, without mutating input', () => {
  const techniques = ['z', 'd', 'b', 'a', 'c'].map((slug) => ({
    slug,
    tags: slug === 'z' || slug === 'd' ? ['x'] : [],
  }));
  const updated = computeRelated(techniques, new Map());
  assert.deepEqual(updated[0].related_techniques, ['d', 'a', 'b']);
  assert.deepEqual(updated[1].related_techniques, ['z', 'a', 'b']);
  assert.ok(techniques.every((t) => t.related_techniques === undefined));
  assert.deepEqual(
    computeRelated([techniques[0]], new Map())[0].related_techniques,
    []
  );
});

test('a second file run changes nothing and other fields and formatting survive', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'related-test-'));
  try {
    const techniquesPath = path.join(dir, 'techniques.json');
    const vectorsPath = path.join(dir, 'vectors.json');
    const techniques = [
      {
        slug: 'a',
        tags: ['x'],
        description: 'Unchanged',
        related_techniques: [],
      },
      { slug: 'b', tags: ['y'] },
      { slug: 'new', tags: ['x'] },
    ];
    await fs.writeFile(
      techniquesPath,
      `${JSON.stringify(techniques, null, 2)}\n`
    );
    await fs.writeFile(vectorsPath, JSON.stringify(embeddingFile));
    assert.deepEqual(await generateRelated({ techniquesPath, vectorsPath }), {
      techniques: 3,
      tagsOnly: 1,
      orphansBefore: 3,
      orphans: 0,
      changed: 3,
    });
    const first = await fs.readFile(techniquesPath, 'utf8');
    const stripRelated = ({ related_techniques: _related, ...rest }) => rest;
    assert.deepEqual(
      JSON.parse(first).map(stripRelated),
      techniques.map(stripRelated)
    );
    assert.equal(first, `${JSON.stringify(JSON.parse(first), null, 2)}\n`);
    assert.equal(
      (await generateRelated({ techniquesPath, vectorsPath })).changed,
      0
    );
    assert.equal(await fs.readFile(techniquesPath, 'utf8'), first);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
