import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeGraph } from '../src/graph/index.js';
import type { JsonLdGraph } from '../src/graph/types.js';
import { ClefRanker, type RankedCandidate } from '../src/ranking/clef.js';
import fixture from './fixtures/test-graph.json' with { type: 'json' };

const techniques = new KnowledgeGraph(
  fixture as unknown as JsonLdGraph
).getAllTechniques();
const candidates: RankedCandidate[] = techniques.map((technique, i) => ({
  technique,
  retrievalScore: 1 / (i + 1),
}));
describe('Clef ranking contract and fallback', () => {
  beforeEach(() => vi.stubEnv('RANKING_ENABLED', 'true'));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('starts all candidates in parallel and uses runtime tags/goals', async () => {
    const pending: Array<() => void> = [];
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, init) =>
          new Promise((resolve) => {
            bodies.push(JSON.parse(init.body));
            const score = bodies.length / candidates.length;
            pending.push(() =>
              resolve(
                Response.json({
                  answers: { relevant: { type: 'noul', noul: score } },
                })
              )
            );
          })
      )
    );
    const operation = new ClefRanker().rank('A model claim', candidates);
    expect(pending).toHaveLength(candidates.length);
    for (const resolve of pending) {
      resolve();
    }
    const result = await operation;
    expect(result.rankingAvailable).toBe(true);
    expect(result.candidates[0].technique.slug).toBe(
      candidates.at(-1)?.technique.slug
    );
    expect(result.candidates[0].retrievalScore).toBe(
      candidates.at(-1)?.retrievalScore
    );
    expect(bodies[0].state).toEqual({
      claim: 'A model claim',
      technique: {
        name: techniques[0].name,
        description: techniques[0].description,
        goals: techniques[0].goals,
        tags: techniques[0].tags,
      },
    });
  });

  it.each([404, 500])(
    'keeps original order and retrieval scores on HTTP %s',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('', { status }))
      );
      const result = await new ClefRanker().rank('claim', candidates);
      expect(result.rankingAvailable).toBe(false);
      expect(result.candidates.map((c) => c.technique.slug)).toEqual(
        candidates.map((c) => c.technique.slug)
      );
      expect(result.candidates.map((c) => c.score)).toEqual(
        candidates.map((c) => c.retrievalScore)
      );
    }
  );

  it.each([-0.1, 1.1, '0.5', null])(
    'rejects invalid probability %s',
    async (noul) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          Response.json({ answers: { relevant: { type: 'noul', noul } } })
        )
      );
      expect(
        (await new ClefRanker().rank('claim', candidates)).rankingAvailable
      ).toBe(false);
    }
  );

  it('falls back atomically if one candidate fails', async () => {
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ++call === 2
          ? new Response('', { status: 404 })
          : Response.json({
              answers: { relevant: { type: 'noul', noul: 0.9 } },
            })
      )
    );
    const result = await new ClefRanker().rank('claim', candidates);
    expect(result.rankingAvailable).toBe(false);
    expect(result.candidates.map((c) => c.score)).toEqual(
      candidates.map((c) => c.retrievalScore)
    );
  });

  it('enforces a whole-step deadline even if fetch ignores abort', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise(() => {
              // Never settles.
            })
        )
      );
      const operation = new ClefRanker(30_000).rank('claim', candidates);
      await vi.advanceTimersByTimeAsync(30_000);
      expect((await operation).rankingAvailable).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back on connection errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('ECONNREFUSED')))
    );
    expect(
      (await new ClefRanker().rank('claim', candidates)).rankingAvailable
    ).toBe(false);
    expect(await new ClefRanker().isAvailable()).toBe(false);
  });
  it('does not report a known failed runner as available just because the model is installed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        String(url).endsWith('/api/tags')
          ? Response.json({ models: [{ name: 'clef-flash:latest' }] })
          : new Response('', { status: 500 })
      )
    );
    const ranker = new ClefRanker();
    expect(await ranker.isAvailable()).toBe(true);
    await ranker.rank('claim', candidates);
    expect(await ranker.isAvailable()).toBe(false);
  });
});
