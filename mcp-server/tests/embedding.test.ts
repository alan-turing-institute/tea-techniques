import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadGraphData } from '../src/data/loader.js';
import { buildCorpus, corpusHash } from '../src/embedding/corpus.js';
import { loadEmbeddings } from '../src/embedding/loader.js';
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_PRECISION,
  type Extractor,
  embedQuery,
  MODEL_ID,
  MODEL_REVISION,
  QUERY_PREFIX,
} from '../src/embedding/model.js';
import { PROBE_TEXTS } from '../src/embedding/probes.js';
import { computeRRFScores } from '../src/embedding/search.js';
import {
  CATALOGUE_MODEL,
  DOCUMENT_FORMAT,
  IN_PROCESS_MODEL,
} from '../src/embedding/specs.js';
import {
  EmbeddingsFileSchema,
  readStoredVector,
} from '../src/embedding/types.js';
import { encodeVector } from '../src/embedding/vectors.js';
import { KnowledgeGraph } from '../src/graph/index.js';
import type { JsonLdGraph } from '../src/graph/types.js';
import fixture from './fixtures/test-graph.json' with { type: 'json' };

const SHA256_HEX = /^[0-9a-f]{64}$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function withFile(
  file: object,
  test: (dir: string) => Promise<void>
): Promise<void> {
  await fs.mkdir('generated', { recursive: true });
  const dir = await fs.mkdtemp(path.resolve('generated', 'embedding-test-'));
  try {
    await fs.mkdir(path.join(dir, 'ld'));
    await fs.writeFile(
      path.join(dir, 'ld/embeddings.json'),
      JSON.stringify(file)
    );
    await test(dir);
  } finally {
    await fs.rm(dir, { recursive: true });
  }
}
const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) =>
  i === 0 ? 1 : 0
);
const valid = {
  modelId: MODEL_ID,
  modelRevision: MODEL_REVISION,
  dtype: EMBEDDING_PRECISION,
  queryPrefix: QUERY_PREFIX,
  documentFormat: DOCUMENT_FORMAT,
  dimensions: EMBEDDING_DIMENSIONS,
  corpusSize: 1,
  entries: [{ slug: 'test', vector }],
};
describe('embedding compatibility and offline loading', () => {
  it('accepts the query model and refuses a different model at identical dimensions', async () => {
    await withFile(valid, async (dataDir) =>
      expect((await loadEmbeddings({ local: true, dataDir }))?.modelId).toBe(
        MODEL_ID
      )
    );
    await withFile({ ...valid, modelId: 'another-model' }, async (dataDir) =>
      expect(await loadEmbeddings({ local: true, dataDir })).toBeNull()
    );
  });
  it('refuses malformed corpus counts and vector lengths', async () => {
    await withFile({ ...valid, corpusSize: 2 }, async (dataDir) =>
      expect(await loadEmbeddings({ local: true, dataDir })).toBeNull()
    );
    await withFile({ ...valid, dimensions: 768 }, async (dataDir) =>
      expect(await loadEmbeddings({ local: true, dataDir })).toBeNull()
    );
  });
  it('reads base64 float32 vectors exactly and refuses one of the wrong length', async () => {
    const stored = Float32Array.from({ length: 6 }, (_, i) => 0.1 * (i + 1));
    expect(readStoredVector(encodeVector(stored), 6)).toEqual(stored);
    expect(readStoredVector(encodeVector(stored), 5)).toBeNull();
    expect(readStoredVector('not base64!', 6)).toBeNull();
    const catalogue = {
      ...valid,
      modelId: CATALOGUE_MODEL.modelId,
      modelRevision: CATALOGUE_MODEL.revision,
      dtype: CATALOGUE_MODEL.dtype,
      queryPrefix: CATALOGUE_MODEL.queryPrefix,
      dimensions: CATALOGUE_MODEL.dimensions,
    };
    const unit = new Float32Array(CATALOGUE_MODEL.dimensions);
    unit[7] = 1;
    await withFile(
      { ...catalogue, entries: [{ slug: 'test', vector: encodeVector(unit) }] },
      async (dataDir) => {
        const index = await loadEmbeddings({
          local: true,
          dataDir,
          expect: CATALOGUE_MODEL,
        });
        expect(index?.vectors[0]).toEqual(unit);
        // The in-process model's file check refuses the larger model's file.
        expect(await loadEmbeddings({ local: true, dataDir })).toBeNull();
      }
    );
    await withFile(
      {
        ...catalogue,
        entries: [{ slug: 'test', vector: encodeVector(stored) }],
      },
      async (dataDir) =>
        expect(
          await loadEmbeddings({
            local: true,
            dataDir,
            expect: CATALOGUE_MODEL,
          })
        ).toBeNull()
    );
  });
  it('hashes the corpus texts, slugs and order', () => {
    const corpus = [
      { slug: 'a', text: 'title: A | text: one' },
      { slug: 'b', text: 'title: B | text: two' },
    ];
    expect(corpusHash(corpus)).toMatch(SHA256_HEX);
    expect(corpusHash(corpus)).toBe(corpusHash(structuredClone(corpus)));
    expect(corpusHash([...corpus].reverse())).not.toBe(corpusHash(corpus));
    expect(
      corpusHash([corpus[0], { ...corpus[1], text: 'title: B | text: 2' }])
    ).not.toBe(corpusHash(corpus));
    expect(corpusHash([{ ...corpus[0], slug: 'c' }, corpus[1]])).not.toBe(
      corpusHash(corpus)
    );
  });
  it('keeps probe sentences with their vectors and refuses a probe of the wrong length', async () => {
    const probes = [{ text: 'A probe sentence.', vector }];
    await withFile({ ...valid, probes }, async (dataDir) =>
      expect((await loadEmbeddings({ local: true, dataDir }))?.probes).toEqual(
        probes
      )
    );
    await withFile(
      { ...valid, probes: [{ text: 'Short.', vector: vector.slice(1) }] },
      async (dataDir) =>
        expect(await loadEmbeddings({ local: true, dataDir })).toBeNull()
    );
  });
  it('publishes three short claims and one near the 2000-character claim limit as probes', () => {
    expect(PROBE_TEXTS).toHaveLength(4);
    expect(PROBE_TEXTS.slice(0, 3).every((t) => t.length < 200)).toBe(true);
    expect(PROBE_TEXTS[3].length).toBeGreaterThanOrEqual(1900);
    expect(PROBE_TEXTS[3].length).toBeLessThanOrEqual(2000);
  });
  it('offline mode never attempts remote loading', async () => {
    vi.stubEnv('TEA_OFFLINE', '1');
    const fetch = vi.fn(() => {
      throw new Error('Network forbidden');
    });
    vi.stubGlobal('fetch', fetch);
    expect(await loadEmbeddings({})).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses the query prompt and the model sentence dimensions', async () => {
    const model = vi.fn<Extractor>(async () => ({
      data: new Float32Array(vector),
      dims: [1, EMBEDDING_DIMENSIONS],
    }));
    const result = await embedQuery(model, 'claim');
    expect(result?.length).toBe(EMBEDDING_DIMENSIONS);
    expect(result?.[0]).toBe(1);
    expect(model.mock.calls[0][0]).toEqual([`${QUERY_PREFIX}claim`]);
  });
  it('uses document titles from the loaded data', () => {
    const techniques = new KnowledgeGraph(
      fixture as unknown as JsonLdGraph
    ).getAllTechniques();
    expect(buildCorpus(techniques)[0].text).toBe(
      `title: ${techniques[0].name} | text: ${techniques[0].description}`
    );
  });
});

describe('committed vectors files', () => {
  const files = [
    [
      'the HTTP service catalogue',
      '../vectors/embeddings.qwen3.json',
      CATALOGUE_MODEL,
    ],
    [
      'the stdio server catalogue',
      '../../public/data/ld/embeddings.json',
      IN_PROCESS_MODEL,
    ],
  ] as const;
  it.each(files)(
    '%s records its model, prefixes, data commit and corpus hash',
    async (_label, location, spec) => {
      const file = EmbeddingsFileSchema.parse(
        JSON.parse(
          await fs.readFile(new URL(location, import.meta.url), 'utf8')
        )
      );
      expect(file).toMatchObject({
        modelId: spec.modelId,
        modelRepo: spec.repo,
        modelRevision: spec.revision,
        dtype: spec.dtype,
        dimensions: spec.dimensions,
        queryPrefix: spec.queryPrefix,
        documentFormat: spec.documentFormat,
      });
      expect(file.dataCommit).toMatch(COMMIT_SHA);
      expect(file.corpusSha256).toMatch(SHA256_HEX);
      expect(file.probes?.map((p) => p.text)).toEqual(PROBE_TEXTS);
    }
  );
  it('lets the stdio server load the published file', async () => {
    const dataDir = fileURLToPath(
      new URL('../../public/data', import.meta.url)
    );
    expect((await loadEmbeddings({ local: true, dataDir }))?.modelId).toBe(
      MODEL_ID
    );
  });
  it('makes the published vectors from the published graph', async () => {
    const dataDir = fileURLToPath(
      new URL('../../public/data', import.meta.url)
    );
    const [index, graph] = await Promise.all([
      loadEmbeddings({ local: true, dataDir }),
      loadGraphData({ local: true, dataDir }),
    ]);
    // Regenerate with `pnpm generate-embeddings --model=minilm` after a data change.
    expect(index?.corpusSha256).toBe(
      corpusHash(buildCorpus(new KnowledgeGraph(graph).getAllTechniques()))
    );
  });
});

describe('rank fusion weights', () => {
  const rankings = [
    ['a', 'b', 'c'],
    ['c', 'a'],
  ];
  it('treats weights that sum to zero as equal weights', () => {
    const zeroed = computeRRFScores(rankings, 60, [0, 0]);
    expect(zeroed).toEqual(computeRRFScores(rankings));
    expect(zeroed.every((r) => Number.isFinite(r.score))).toBe(true);
  });
  it('treats a lone ranking with weight zero as unit weight', () => {
    expect(computeRRFScores([rankings[0]], 60, [0, 1])).toEqual(
      computeRRFScores([rankings[0]])
    );
  });
});
