import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMBEDDING_DIMENSIONS,
  getEmbeddingModel,
  MODEL_ID,
} from '../src/embedding/model.js';
import {
  MAX_QUERY_VECTOR_LENGTH,
  prepareQueryEmbedding,
} from '../src/embedding/search.js';
import { KnowledgeGraph } from '../src/graph/index.js';
import type { JsonLdGraph } from '../src/graph/types.js';
import { summarise } from '../src/ranking/clef.js';
import fixture from './fixtures/test-graph.json' with { type: 'json' };

vi.mock('../src/embedding/model.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/embedding/model.js')>()),
  getEmbeddingModel: vi.fn(async () => null),
}));

const data = fixture as unknown as JsonLdGraph;
const claim = 'explain model predictions';
const slugs = [
  'shapley-additive-explanations',
  'permutation-importance',
  'mean-decrease-impurity',
];
const basis = (i: number): number[] =>
  Array.from({ length: EMBEDDING_DIMENSIONS }, (_, j) => (j === i ? 1 : 0));
const graphWithVectors = () =>
  new KnowledgeGraph(data, {
    modelId: MODEL_ID,
    dimensions: EMBEDDING_DIMENSIONS,
    slugs,
    vectors: slugs.map((_, i) => new Float32Array(basis(i))),
  });
const keywordOnly = new KnowledgeGraph(data);
const errors = vi.spyOn(console, 'error');

beforeEach(() => {
  errors.mockImplementation(() => {
    // Rejected vectors log a diagnostic; the tests read it from the spy.
  });
  // The semantic leg alone decides the order, so the supplied vector is visible in it.
  vi.stubEnv('RRF_KEYWORD_WEIGHT', '0');
});
afterEach(() => {
  vi.unstubAllEnvs();
  errors.mockReset();
  vi.mocked(getEmbeddingModel).mockClear();
});

describe('supplied query vector', () => {
  it('is used instead of the in-process model and sets semanticUsed', async () => {
    const graph = graphWithVectors();
    await Promise.all(
      slugs.map(async (slug, i) => {
        const result = await graph.suggestForClaim(claim, {
          queryEmbedding: { model: MODEL_ID, vector: basis(i) },
        });
        expect(result.semanticUsed).toBe(true);
        expect(result.results[0].slug).toBe(slug);
      })
    );
    expect(getEmbeddingModel).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it('is ignored with a single log line that never contains the values', async () => {
    const wrongLength = basis(1).slice(1).fill(0.123_456_789);
    const result = await graphWithVectors().suggestForClaim(claim, {
      queryEmbedding: { model: MODEL_ID, vector: wrongLength },
    });
    expect(result.semanticUsed).toBe(false);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(String(errors.mock.calls[0][0])).toContain('767 values');
    expect(String(errors.mock.calls[0][0])).not.toContain('0.123');
  });

  it.each([
    ['a different model id', { model: 'another-model', vector: basis(0) }],
    ['too few values', { model: MODEL_ID, vector: basis(0).slice(1) }],
    ['too many values', { model: MODEL_ID, vector: basis(0).concat(basis(0)) }],
    [
      'more than the 4096 limit',
      {
        model: MODEL_ID,
        vector: new Array(MAX_QUERY_VECTOR_LENGTH + 1).fill(1),
      },
    ],
    [
      'a NaN',
      {
        model: MODEL_ID,
        vector: basis(0).map((v, i) => (i === 5 ? Number.NaN : v)),
      },
    ],
    [
      'an infinite value',
      {
        model: MODEL_ID,
        vector: basis(0).map((v, i) =>
          i === 5 ? Number.POSITIVE_INFINITY : v
        ),
      },
    ],
    [
      'a value that overflows 32-bit floats',
      {
        model: MODEL_ID,
        vector: basis(0).map((v, i) => (i === 5 ? 1e300 : v)),
      },
    ],
    ['a zero vector', { model: MODEL_ID, vector: basis(0).map(() => 0) }],
  ])('gives keyword-only results for %s', async (_label, queryEmbedding) => {
    const result = await graphWithVectors().suggestForClaim(claim, {
      queryEmbedding,
    });
    const expected = await keywordOnly.suggestForClaim(claim);
    expect(result.semanticUsed).toBe(false);
    expect(result.results.map((t) => [t.slug, t.retrievalScore])).toEqual(
      expected.results.map((t) => [t.slug, t.retrievalScore])
    );
    expect(getEmbeddingModel).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it('gives keyword-only results when the service has no vectors', async () => {
    const result = await keywordOnly.suggestForClaim(claim, {
      queryEmbedding: { model: MODEL_ID, vector: basis(0) },
    });
    expect(result.semanticUsed).toBe(false);
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it('is scaled to unit length before use', () => {
    const scaled = basis(3).map((v) => v * 7);
    scaled[4] = 24;
    const prepared = prepareQueryEmbedding(
      { model: MODEL_ID, vector: scaled },
      { modelId: MODEL_ID, dimensions: EMBEDDING_DIMENSIONS }
    );
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.vector[3]).toBeCloseTo(0.28, 6);
      expect(prepared.vector[4]).toBeCloseTo(0.96, 6);
    }
  });
});

describe('result fields', () => {
  it('carries a one-sentence summary and the tags of each technique', async () => {
    const result = await keywordOnly.suggestForClaim(claim);
    expect(result.results.length).toBeGreaterThan(0);
    for (const item of result.results) {
      const technique = keywordOnly.getTechnique(item.slug);
      expect(item.summary).toBe(summarise(technique?.description ?? ''));
      expect(item.summary.length).toBeLessThanOrEqual(200);
      expect(item.tags).toEqual(technique?.tags);
    }
    expect(result.semanticUsed).toBe(false);
  });
});
