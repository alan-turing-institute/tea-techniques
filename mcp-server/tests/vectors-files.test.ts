import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, type TestContext } from 'vitest';
import { loadGraphData } from '../src/data/loader.js';
import { buildCorpus, corpusHash } from '../src/embedding/corpus.js';
import { loadEmbeddings } from '../src/embedding/loader.js';
import { MODEL_ID } from '../src/embedding/model.js';
import { PROBE_TEXTS } from '../src/embedding/probes.js';
import { CATALOGUE_MODEL, IN_PROCESS_MODEL } from '../src/embedding/specs.js';
import { EmbeddingsFileSchema } from '../src/embedding/types.js';
import { KnowledgeGraph } from '../src/graph/index.js';

const SHA256_HEX = /^[0-9a-f]{64}$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;

const publishedDir = fileURLToPath(
  new URL('../../public/data', import.meta.url)
);
const publishedFile = path.join(publishedDir, 'ld/embeddings.json');

/**
 * The website build writes the stdio server's vectors file; git does not hold it.
 * Where it does not exist a test skips, unless `TEA_REQUIRE_PUBLISHED_VECTORS=1`,
 * which the website build sets: there a missing file fails.
 */
function needPublishedFile(skip: TestContext['skip']): void {
  if (existsSync(publishedFile)) {
    return;
  }
  const origin =
    'public/data/ld/embeddings.json is made by the "Generate the MiniLM vectors" step of the Build job in .github/workflows/ci-cd.yml';
  if (process.env.TEA_REQUIRE_PUBLISHED_VECTORS === '1') {
    throw new Error(`${origin}, and it does not exist`);
  }
  skip(
    `${origin}; run the MiniLM command under "Regenerating the vectors" in mcp-server/README.md to test it`
  );
}

describe('vectors files', () => {
  const files = [
    [
      'the HTTP service catalogue',
      fileURLToPath(
        new URL('../vectors/embeddings.qwen3.json', import.meta.url)
      ),
      CATALOGUE_MODEL,
    ],
    ['the stdio server catalogue', publishedFile, IN_PROCESS_MODEL],
  ] as const;
  it.for(files)(
    '%s records its model, prefixes, data commit and corpus hash',
    async ([_label, location, spec], { skip }) => {
      if (location === publishedFile) {
        needPublishedFile(skip);
      }
      const file = EmbeddingsFileSchema.parse(
        JSON.parse(await fs.readFile(location, 'utf8'))
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
  it('lets the stdio server load the published file', async ({ skip }) => {
    needPublishedFile(skip);
    expect(
      (await loadEmbeddings({ local: true, dataDir: publishedDir }))?.modelId
    ).toBe(MODEL_ID);
  });
  it('makes the published vectors from the published graph', async ({
    skip,
  }) => {
    needPublishedFile(skip);
    const [index, graph] = await Promise.all([
      loadEmbeddings({ local: true, dataDir: publishedDir }),
      loadGraphData({ local: true, dataDir: publishedDir }),
    ]);
    expect(index?.corpusSha256).toBe(
      corpusHash(buildCorpus(new KnowledgeGraph(graph).getAllTechniques()))
    );
  });
});
