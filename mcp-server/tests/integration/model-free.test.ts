import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCorpus, corpusHash } from '../../src/embedding/corpus.js';
import { getEmbeddingModel } from '../../src/embedding/model.js';
import { PROBE_TEXTS } from '../../src/embedding/probes.js';
import { CATALOGUE_MODEL } from '../../src/embedding/specs.js';
import type { EmbeddingsIndex } from '../../src/embedding/types.js';
import { encodeVector } from '../../src/embedding/vectors.js';
import { KnowledgeGraph } from '../../src/graph/index.js';
import type { JsonLdGraph } from '../../src/graph/types.js';
import { createHttpServer, createRanker, loadRuntime } from '../../src/http.js';
import fixture from '../fixtures/test-graph.json' with { type: 'json' };

vi.mock('../../src/embedding/model.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/embedding/model.js')>()),
  getEmbeddingModel: vi.fn(async () => null),
}));

const EMBEDDINGS_REQUIRED = /embeddings/;
const DIFFERENT_CORPUS = /corpus hash differs/;
const { modelId: MODEL_ID, dimensions: DIMENSIONS } = CATALOGUE_MODEL;
const data = fixture as unknown as JsonLdGraph;
const slugs = [
  'shapley-additive-explanations',
  'permutation-importance',
  'mean-decrease-impurity',
];
const basis = (i: number): number[] =>
  Array.from({ length: DIMENSIONS }, (_, j) => (j === i ? 1 : 0));
const index = (withProbes: boolean): EmbeddingsIndex => ({
  modelId: MODEL_ID,
  dimensions: DIMENSIONS,
  slugs,
  vectors: slugs.map((_, i) => new Float32Array(basis(i))),
  queryPrefix: CATALOGUE_MODEL.queryPrefix,
  documentFormat: CATALOGUE_MODEL.documentFormat,
  ...(withProbes
    ? { probes: PROBE_TEXTS.map((text, i) => ({ text, vector: basis(i) })) }
    : {}),
});

interface Spec {
  modelId: string;
  dimensions: number;
  queryPrefix: string;
  documentFormat: string;
  dataVersion: string;
  probes: Array<{ text: string; vector: number[] }>;
}

/** Uses node:http so that stubbing the global fetch does not intercept the test's own requests. */
function get<T>(
  base: string,
  route: string
): Promise<{ status: number; body: T }> {
  return new Promise((resolve, reject) => {
    http
      .get(`${base}${route}`, (response) => {
        let text = '';
        response.on('data', (chunk) => {
          text += chunk;
        });
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            body: JSON.parse(text) as T,
          })
        );
      })
      .on('error', reject);
  });
}

async function serve(graph: KnowledgeGraph): Promise<{
  base: string;
  stop: () => Promise<void>;
}> {
  const server = createHttpServer(graph, 'test-cut');
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    base: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    stop: () => {
      server.closeAllConnections();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

const serviceGraph = (embeddings: EmbeddingsIndex | null) =>
  new KnowledgeGraph(data, embeddings, createRanker(), {
    inProcessEmbedding: false,
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.mocked(getEmbeddingModel).mockClear();
});

describe('GET /embedding-spec', () => {
  it('returns the model, prefixes, data version and the probe vectors from the file', async () => {
    const { base, stop } = await serve(serviceGraph(index(true)));
    try {
      const { status, body } = await get<Spec>(base, '/embedding-spec');
      expect(status).toBe(200);
      expect(Object.keys(body)).toEqual([
        'modelId',
        'dimensions',
        'queryPrefix',
        'documentFormat',
        'dataVersion',
        'probes',
      ]);
      expect(body).toMatchObject({
        modelId: MODEL_ID,
        dimensions: DIMENSIONS,
        queryPrefix: CATALOGUE_MODEL.queryPrefix,
        documentFormat: CATALOGUE_MODEL.documentFormat,
        dataVersion: 'test-cut',
      });
      expect(body.queryPrefix.endsWith('\nQuery:')).toBe(true);
      expect(body.probes.map((p) => p.text)).toEqual(PROBE_TEXTS);
      expect(body.probes.every((p) => p.vector.length === DIMENSIONS)).toBe(
        true
      );
    } finally {
      await stop();
    }
  });

  it('is unavailable when the loaded vectors carry no probes', async () => {
    await Promise.all(
      [index(false), null].map(async (embeddings) => {
        const { base, stop } = await serve(serviceGraph(embeddings));
        try {
          expect((await get(base, '/embedding-spec')).status).toBe(404);
        } finally {
          await stop();
        }
      })
    );
  });
});

describe('/healthz without a model', () => {
  beforeEach(() => vi.stubEnv('RANKING_ENABLED', 'false'));

  it('reports the model from the vectors and makes no Ollama call', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('unreachable')));
    vi.stubGlobal('fetch', fetchSpy);
    const { base, stop } = await serve(serviceGraph(index(true)));
    try {
      const { body } = await get(base, '/healthz');
      expect(body).toMatchObject({
        ok: true,
        embeddingModel: MODEL_ID,
        rankingAvailable: false,
        dataVersion: 'test-cut',
      });
      expect(fetchSpy).not.toHaveBeenCalled();

      // Positive control: with ranking enabled the same probe does reach for Ollama.
      vi.stubEnv('RANKING_ENABLED', 'true');
      const probing = await serve(serviceGraph(index(true)));
      try {
        await get(probing.base, '/healthz');
        expect(fetchSpy).toHaveBeenCalled();
      } finally {
        await probing.stop();
      }
    } finally {
      await stop();
    }
  });
});

describe('tools/call with a supplied vector', () => {
  it('uses the vector and reports semanticUsed over HTTP', async () => {
    vi.stubEnv('RRF_KEYWORD_WEIGHT', '0');
    const { base, stop } = await serve(serviceGraph(index(true)));
    try {
      const call = async (queryEmbedding: unknown) => {
        const response = await fetch(`${base}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
              name: 'suggest_techniques_for_claim',
              arguments: { claim: 'explain model predictions', queryEmbedding },
            },
          }),
        });
        return (await response.json()).result.structuredContent as {
          semanticUsed: boolean;
          embeddingModel: string;
          results: Array<{ slug: string; summary: string; tags: string[] }>;
        };
      };
      const used = await call({ model: MODEL_ID, vector: basis(2) });
      expect(used.semanticUsed).toBe(true);
      expect(used.embeddingModel).toBe(MODEL_ID);
      expect(used.results[0].slug).toBe('mean-decrease-impurity');
      expect(used.results[0].summary.length).toBeGreaterThan(0);
      expect(used.results[0].tags.length).toBeGreaterThan(0);
      const ignored = await call({ model: 'another-model', vector: basis(2) });
      expect(ignored.semanticUsed).toBe(false);
      expect(getEmbeddingModel).not.toHaveBeenCalled();
    } finally {
      await stop();
    }
  });
});

describe('start-up', () => {
  const corpus = buildCorpus(new KnowledgeGraph(data).getAllTechniques());

  async function dataDir(
    embeddings: 'none' | 'matching' | 'other-corpus' | 'no-hash'
  ): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcpfree-data-'));
    await fs.mkdir(path.join(dir, 'ld'));
    await fs.writeFile(path.join(dir, 'ld/graph.jsonld'), JSON.stringify(data));
    await fs.writeFile(path.join(dir, 'data-version'), 'abc123\n');
    if (embeddings !== 'none') {
      const unit = encodeVector(basis(0));
      await fs.writeFile(
        path.join(dir, 'ld/embeddings.json'),
        JSON.stringify({
          modelId: MODEL_ID,
          modelRepo: CATALOGUE_MODEL.repo,
          modelRevision: CATALOGUE_MODEL.revision,
          dtype: CATALOGUE_MODEL.dtype,
          queryPrefix: CATALOGUE_MODEL.queryPrefix,
          documentFormat: CATALOGUE_MODEL.documentFormat,
          dimensions: DIMENSIONS,
          corpusSize: corpus.length,
          ...(embeddings === 'no-hash'
            ? {}
            : {
                corpusSha256: corpusHash(
                  embeddings === 'matching'
                    ? corpus
                    : [{ slug: 'x', text: 'another corpus' }]
                ),
              }),
          probes: [{ text: PROBE_TEXTS[0], vector: unit }],
          entries: corpus.map((e) => ({ slug: e.slug, vector: unit })),
        })
      );
    }
    return dir;
  }

  it('succeeds offline with vectors and no model cache, and never loads a model', async () => {
    const dir = await dataDir('matching');
    const emptyCache = await fs.mkdtemp(
      path.join(os.tmpdir(), 'mcpfree-cache-')
    );
    vi.stubEnv('TEA_OFFLINE', '1');
    vi.stubEnv('EMBEDDING_CACHE_DIR', emptyCache);
    try {
      const { graph, dataVersion } = await loadRuntime(dir);
      expect(dataVersion).toBe('abc123');
      expect(graph.embeddingModelId()).toBe(MODEL_ID);
      const result = await graph.suggestForClaim('explain model predictions');
      expect(result.semanticUsed).toBe(false);
      expect(getEmbeddingModel).not.toHaveBeenCalled();
    } finally {
      await fs.rm(dir, { recursive: true });
      await fs.rm(emptyCache, { recursive: true });
    }
  });

  it('refuses to start offline without vectors', async () => {
    const dir = await dataDir('none');
    vi.stubEnv('TEA_OFFLINE', '1');
    try {
      await expect(loadRuntime(dir)).rejects.toThrow(EMBEDDINGS_REQUIRED);
    } finally {
      await fs.rm(dir, { recursive: true });
    }
  });

  it.each([
    ['vectors made from a different corpus', 'other-corpus'],
    ['vectors that record no corpus hash', 'no-hash'],
  ] as const)('refuses to start with %s', async (_label, embeddings) => {
    const dir = await dataDir(embeddings);
    vi.stubEnv('TEA_OFFLINE', '1');
    try {
      await expect(loadRuntime(dir)).rejects.toThrow(DIFFERENT_CORPUS);
    } finally {
      await fs.rm(dir, { recursive: true });
    }
  });
});
