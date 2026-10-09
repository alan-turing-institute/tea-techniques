import { expect, it, vi } from 'vitest';
import { EMBEDDING_DIMENSIONS, MODEL_ID } from '../src/embedding/model.js';
import { KnowledgeGraph } from '../src/graph/index.js';
import type { JsonLdGraph } from '../src/graph/types.js';
import type { Ranker } from '../src/ranking/clef.js';
import fixture from './fixtures/test-graph.json' with { type: 'json' };

vi.mock('../src/embedding/model.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../src/embedding/model.js')>();
  return {
    ...original,
    getEmbeddingModel: async () => () => {
      // Stub extractor; embedQuery is mocked separately.
    },
    embedQuery: async () =>
      new Float32Array(
        Array.from({ length: original.EMBEDDING_DIMENSIONS }, (_, i) =>
          i === 0 ? 1 : 0
        )
      ),
  };
});

it('ranks twenty retrieved candidates before applying the requested output limit', async () => {
  const source = fixture['@graph'].find((n) => n['@type'] === 'Technique');
  if (!source) {
    throw new Error('Fixture has no technique');
  }
  const copies = Array.from({ length: 30 }, (_, i) => ({
    ...source,
    '@id': `tea:technique/copy-${i}`,
    slug: `copy-${i}`,
    name: `Technique ${i}`,
  }));
  const data = { ...fixture, '@graph': copies } as unknown as JsonLdGraph;
  const rank = vi.fn<Ranker['rank']>(async (_claim, candidates) => ({
    rankingAvailable: true,
    candidates: [...candidates]
      .reverse()
      .map((candidate, i) => ({
        ...candidate,
        score: 1 - i / 20,
        ranked: true,
      })),
  }));
  const graph = new KnowledgeGraph(
    data,
    {
      modelId: MODEL_ID,
      dimensions: EMBEDDING_DIMENSIONS,
      slugs: copies.map((t) => t.slug),
      vectors: copies.map(
        () =>
          new Float32Array(
            Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) =>
              i === 0 ? 1 : 0
            )
          )
      ),
    },
    { rank, isAvailable: async () => true }
  );
  const result = await graph.suggestForClaim('explain model predictions', {
    limit: 3,
  });
  expect(rank.mock.calls[0][1]).toHaveLength(20);
  expect(result.results).toHaveLength(3);
  expect(result.results[0].slug).toBe(
    rank.mock.calls[0][1].at(-1)?.technique.slug
  );
  expect(result.results.map((t) => t.score)).toEqual([1, 0.95, 0.9]);
  expect(result.results.map((t) => t.ranked)).toEqual([true, true, true]);
});

it('gives the same order and scores with both fusion weights at zero as with the defaults', async () => {
  const passThrough: Ranker = {
    isAvailable: async () => false,
    rank: async (_claim, candidates) => ({
      rankingAvailable: false,
      candidates: candidates.map((c) => ({
        ...c,
        score: c.retrievalScore,
        ranked: false,
      })),
    }),
  };
  const graph = new KnowledgeGraph(
    fixture as unknown as JsonLdGraph,
    null,
    passThrough
  );
  const claim = 'explain model predictions';
  const summary = (r: Awaited<ReturnType<typeof graph.suggestForClaim>>) =>
    r.results.map((t) => [t.slug, t.retrievalScore]);
  const defaults = await graph.suggestForClaim(claim);
  vi.stubEnv('RRF_KEYWORD_WEIGHT', '0');
  vi.stubEnv('RRF_SEMANTIC_WEIGHT', '0');
  try {
    const zeroed = await graph.suggestForClaim(claim);
    expect(zeroed.results.length).toBeGreaterThan(0);
    expect(summary(zeroed)).toEqual(summary(defaults));
  } finally {
    vi.unstubAllEnvs();
  }
});

it('applies exclusions to embedding results as well as keyword results', async () => {
  const graph = new KnowledgeGraph(fixture as unknown as JsonLdGraph);
  const techniques = graph.getAllTechniques();
  const excludedTag = techniques[0].tags[0];
  const tagged = new KnowledgeGraph(fixture as unknown as JsonLdGraph, {
    modelId: MODEL_ID,
    dimensions: EMBEDDING_DIMENSIONS,
    slugs: techniques.map((t) => t.slug),
    vectors: techniques.map(
      () =>
        new Float32Array(
          Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) =>
            i === 0 ? 1 : 0
          )
        )
    ),
  });
  const result = await tagged.suggestForClaim('explain model predictions', {
    context: { excludeModelTypes: [excludedTag] },
  });
  expect(
    result.results.every(
      (t) => graph.getTechnique(t.slug)?.tags.includes(excludedTag) === false
    )
  ).toBe(true);
});
