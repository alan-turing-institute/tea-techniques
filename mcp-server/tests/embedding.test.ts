import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEmbeddings } from '../src/embedding/loader.js';
import {
  buildCorpus,
  DOCUMENT_FORMAT,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_PRECISION,
  type Extractor,
  embedQuery,
  MODEL_ID,
  MODEL_REVISION,
  QUERY_PREFIX,
} from '../src/embedding/model.js';
import { KnowledgeGraph } from '../src/graph/index.js';
import type { JsonLdGraph } from '../src/graph/types.js';
import fixture from './fixtures/test-graph.json' with { type: 'json' };

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
    await withFile({ ...valid, dimensions: 384 }, async (dataDir) =>
      expect(await loadEmbeddings({ local: true, dataDir })).toBeNull()
    );
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
