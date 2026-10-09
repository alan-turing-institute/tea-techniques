import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeGraph } from '../src/graph/index.js';
import type { JsonLdGraph } from '../src/graph/types.js';
import { ollamaUrl } from '../src/ollama.js';
import {
  ClefRanker,
  type RankedCandidate,
  rankingCandidateLimit,
  summarise,
} from '../src/ranking/clef.js';
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

  it('sends one request with a question per candidate and reads answers by key', async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        const body = JSON.parse(init.body);
        bodies.push(body);
        const answers: Record<string, unknown> = {};
        for (const [i, key] of Object.keys(body.questions).entries()) {
          answers[key] = { type: 'noul', noul: (i + 1) / candidates.length };
        }
        return Response.json({ answers });
      })
    );
    const result = await new ClefRanker().rank('A model claim', candidates);
    const n = Math.min(candidates.length, 4);
    expect(bodies).toHaveLength(1);
    const body = bodies[0] as {
      state: { claim: string; candidates: Array<Record<string, unknown>> };
      questions: Record<
        string,
        { instructions: string; criteria: Record<string, string> }
      >;
    };
    expect(Object.keys(body.questions)).toEqual(
      Array.from({ length: n }, (_, i) => `c${i + 1}`)
    );
    expect(body.state.candidates[0]).toEqual({
      id: techniques[0].id,
      name: techniques[0].name,
      summary: summarise(techniques[0].description),
      goals: techniques[0].goals,
      tags: techniques[0].tags,
    });
    for (const [i, q] of Object.values(body.questions).entries()) {
      expect(q.instructions).toContain(`candidates[${i}] (id ${techniques[i].id})`);
      expect(Object.keys(q.criteria)).toEqual(['true', 'false']);
    }
    expect(result.rankingAvailable).toBe(true);
    expect(result.candidates[0].technique.slug).toBe(
      candidates[n - 1].technique.slug
    );
  });

  it('ranks at most RANKING_CANDIDATES and keeps the rest in retrieval order', async () => {
    vi.stubEnv('RANKING_CANDIDATES', '2');
    let asked = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        const questions = JSON.parse(init.body).questions;
        asked = Object.keys(questions).length;
        return Response.json({
          answers: {
            c1: { type: 'noul', noul: 0.1 },
            c2: { type: 'noul', noul: 0.9 },
          },
        });
      })
    );
    const result = await new ClefRanker().rank('claim', candidates);
    expect(asked).toBe(2);
    expect(result.candidates.map((c) => c.technique.slug)).toEqual([
      candidates[1].technique.slug,
      candidates[0].technique.slug,
      ...candidates.slice(2).map((c) => c.technique.slug),
    ]);
  });

  it.each([
    ['0', 1],
    ['-3', 1],
    ['99', 20],
    ['abc', 4],
    ['', 4],
  ])('bounds RANKING_CANDIDATES=%s to %s', (value, expected) => {
    vi.stubEnv('RANKING_CANDIDATES', value);
    expect(rankingCandidateLimit()).toBe(expected);
  });

  it('truncates the summary to the first sentence, at most 200 characters', () => {
    expect(summarise('First one. Second one.')).toBe('First one.');
    const long = `${'word '.repeat(80)}end.`;
    const out = summarise(long);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith('\u2026')).toBe(true);
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

  it('falls back atomically if one answer is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ answers: { c1: { type: 'noul', noul: 0.9 } } })
      )
    );
    const result = await new ClefRanker().rank('claim', candidates);
    expect(result.rankingAvailable).toBe(false);
    expect(result.candidates.map((c) => c.score)).toEqual(
      candidates.map((c) => c.retrievalScore)
    );
  });

  it('aborts the request at the deadline and returns retrieval order', async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn(
          (_url, init) =>
            new Promise((_resolve, reject) => {
              signal = init.signal;
              signal?.addEventListener('abort', () =>
                reject(new Error('aborted'))
              );
            })
        )
      );
      vi.stubEnv('RANKING_DEADLINE_MS', '5000');
      const operation = new ClefRanker().rank('claim', candidates);
      await vi.advanceTimersByTimeAsync(4999);
      expect(signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(signal?.aborted).toBe(true);
      const result = await operation;
      expect(result.rankingAvailable).toBe(false);
      expect(result.candidates.map((c) => c.technique.slug)).toEqual(
        candidates.map((c) => c.technique.slug)
      );
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
  it('reports availability from the model probe and the last outcome separately', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        String(url).endsWith('/api/tags')
          ? Response.json({ models: [{ name: 'clef-flash:latest' }] })
          : new Response('', { status: 500 })
      )
    );
    const ranker = new ClefRanker();
    expect(ranker.lastRankingSucceeded()).toBeUndefined();
    await ranker.rank('claim', candidates);
    expect(ranker.lastRankingSucceeded()).toBe(false);
    expect(await ranker.isAvailable()).toBe(true);
  });
});

describe('Ollama endpoint allow-list', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('accepts host.docker.internal', () => {
    vi.stubEnv('OLLAMA_URL', 'http://host.docker.internal:11434');
    expect(ollamaUrl('/api/tags')).toBe(
      'http://host.docker.internal:11434/api/tags'
    );
  });
  it('refuses other hosts', () => {
    vi.stubEnv('OLLAMA_URL', 'http://evil.example:11434');
    expect(() => ollamaUrl('/api/tags')).toThrow();
  });
});
