/** Generate EmbeddingGemma 2 vectors from graph.jsonld, never from an existing embeddings file. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGraphData } from '../src/data/loader.js';
import {
  batchEmbed,
  buildCorpus,
  DOCUMENT_FORMAT,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_PRECISION,
  getEmbeddingModel,
  MODEL_ID,
  MODEL_REVISION,
  QUERY_PREFIX,
} from '../src/embedding/model.js';
import {
  type EmbeddingsFile,
  EmbeddingsFileSchema,
} from '../src/embedding/types.js';
import { KnowledgeGraph } from '../src/graph/index.js';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const args = process.argv.slice(2);
const arg = (key: string, fallback: string) =>
  args.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) ??
  fallback;
const dataDir = path.resolve(arg('data-dir', path.join(root, 'public/data')));
const output = path.resolve(
  arg('output', path.join(root, 'mcp-server/generated/embeddings.json'))
);
async function main(): Promise<void> {
  const started = performance.now();
  const graph = new KnowledgeGraph(
    await loadGraphData({ local: true, dataDir })
  );
  const corpus = buildCorpus(graph.getAllTechniques());
  if (!corpus.length) {
    throw new Error('Empty corpus');
  }
  // biome-ignore lint/suspicious/noConsole: CLI progress output
  console.log(`Embedding ${corpus.length} entries with ${MODEL_ID}`);
  const model = await getEmbeddingModel({ allowDownload: true });
  if (!model) {
    throw new Error('Embedding model did not load');
  }
  const vectors = await batchEmbed(
    model,
    corpus.map((e) => e.text)
  );
  const file: EmbeddingsFile = {
    modelId: MODEL_ID,
    dimensions: EMBEDDING_DIMENSIONS,
    corpusSize: corpus.length,
    queryPrefix: QUERY_PREFIX,
    documentFormat: DOCUMENT_FORMAT,
    modelRevision: MODEL_REVISION,
    dtype: EMBEDDING_PRECISION,
    entries: corpus.map((entry, i) => ({
      slug: entry.slug,
      vector: Array.from(vectors[i]),
    })),
  };
  EmbeddingsFileSchema.parse(file);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(file));
  // biome-ignore lint/suspicious/noConsole: CLI progress output
  console.log(
    `Written ${output}; ${((performance.now() - started) / 1000).toFixed(1)}s; ${Buffer.byteLength(JSON.stringify(file))} bytes`
  );
}
main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: CLI error output
  console.error(error);
  process.exitCode = 1;
});
