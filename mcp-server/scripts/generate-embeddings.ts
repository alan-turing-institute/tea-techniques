/**
 * Generate catalogue vectors from graph.jsonld, never from an existing embeddings file.
 *
 *   --model=qwen3   The HTTP service's catalogue: Qwen3-Embedding-4B at fp32 through
 *                   onnxruntime-node (needs --model-dir and about 14 GB of memory).
 *                   Vectors are stored as base64 float32.
 *   --model=minilm  The stdio server's in-process model, MiniLM-L12 through
 *                   Transformers.js. Vectors are stored as plain number arrays, which
 *                   earlier releases of the package can also read.
 *
 * The probe sentences are embedded as queries in the same run, so the published probe
 * vectors come from the same model, revision and precision. The file records the model,
 * its prefixes, the data commit and a hash of the corpus texts.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGraphData } from '../src/data/loader.js';
import { buildCorpus, corpusHash } from '../src/embedding/corpus.js';
import {
  batchEmbed,
  embedQuery,
  getEmbeddingModel,
} from '../src/embedding/model.js';
import { PROBE_TEXTS } from '../src/embedding/probes.js';
import {
  CATALOGUE_MODEL,
  type EmbeddingModelSpec,
  IN_PROCESS_MODEL,
} from '../src/embedding/specs.js';
import {
  type EmbeddingsFile,
  EmbeddingsFileSchema,
  type StoredVector,
} from '../src/embedding/types.js';
import { encodeVector } from '../src/embedding/vectors.js';
import { KnowledgeGraph } from '../src/graph/index.js';
import { loadQwen3 } from './qwen3-onnx.js';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const args = process.argv.slice(2);
const arg = (key: string, fallback: string) =>
  args.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) ??
  fallback;
const modelName = arg('model', '');
const dataDir = path.resolve(arg('data-dir', path.join(root, 'public/data')));
const output = path.resolve(
  arg('output', path.join(root, 'mcp-server/generated/embeddings.json'))
);

function normalise(vector: Float32Array): Float32Array {
  let sum = 0;
  for (const v of vector) {
    sum += v * v;
  }
  const norm = Math.sqrt(sum);
  if (!(norm > 0 && Number.isFinite(norm))) {
    throw new Error('Embedding has no usable length');
  }
  return vector.map((v) => v / norm);
}

interface Embedder {
  spec: EmbeddingModelSpec;
  documents: (texts: string[]) => Promise<Float32Array[]>;
  query: (text: string) => Promise<Float32Array>;
  /** Plain number arrays stay readable by earlier releases; base64 is for the larger model. */
  encode: (vector: Float32Array) => StoredVector;
}

async function qwen3(): Promise<Embedder> {
  const modelDir = arg('model-dir', '');
  if (!modelDir) {
    throw new Error('--model-dir is required for --model=qwen3');
  }
  const embed = await loadQwen3(
    path.resolve(modelDir),
    Number(arg('threads', String(Math.min(16, os.availableParallelism()))))
  );
  const spec = CATALOGUE_MODEL;
  let done = 0;
  return {
    spec,
    documents: async (texts) => {
      const vectors: Float32Array[] = [];
      for (const text of texts) {
        // biome-ignore lint/nursery/noAwaitInLoop: one text at a time bounds memory
        vectors.push(normalise(await embed(text)));
        done += 1;
        if (done % 50 === 0) {
          // biome-ignore lint/suspicious/noConsole: CLI progress output
          console.log(`  ${done}/${texts.length}`);
        }
      }
      return vectors;
    },
    query: async (text) => normalise(await embed(`${spec.queryPrefix}${text}`)),
    encode: (vector) => encodeVector(vector),
  };
}

async function minilm(): Promise<Embedder> {
  const model = await getEmbeddingModel({ allowDownload: true });
  if (!model) {
    throw new Error('Embedding model did not load');
  }
  return {
    spec: IN_PROCESS_MODEL,
    documents: (texts) => batchEmbed(model, texts),
    query: async (text) => {
      const vector = await embedQuery(model, text);
      if (!vector) {
        throw new Error('Probe sentence could not be embedded');
      }
      return vector;
    },
    encode: (vector) => Array.from(vector),
  };
}

async function dataCommit(): Promise<string | undefined> {
  const fromArg = arg('data-commit', '');
  if (fromArg) {
    return fromArg;
  }
  const recorded = await fs
    .readFile(path.join(dataDir, 'data-version'), 'utf8')
    .catch(() => '');
  return recorded.trim() || undefined;
}

async function main(): Promise<void> {
  if (modelName !== 'qwen3' && modelName !== 'minilm') {
    throw new Error('--model=qwen3|minilm is required');
  }
  const started = performance.now();
  const graph = new KnowledgeGraph(
    await loadGraphData({ local: true, dataDir })
  );
  const corpus = buildCorpus(graph.getAllTechniques());
  if (!corpus.length) {
    throw new Error('Empty corpus');
  }
  const embedder = await (modelName === 'qwen3' ? qwen3() : minilm());
  const { spec } = embedder;
  // biome-ignore lint/suspicious/noConsole: CLI progress output
  console.log(`Embedding ${corpus.length} entries with ${spec.modelId}`);
  const vectors = await embedder.documents(corpus.map((e) => e.text));
  const probes: NonNullable<EmbeddingsFile['probes']> = [];
  for (const text of PROBE_TEXTS) {
    // biome-ignore lint/nursery/noAwaitInLoop: probes are embedded one at a time, as a client would
    probes.push({ text, vector: embedder.encode(await embedder.query(text)) });
  }
  const file: EmbeddingsFile = {
    modelId: spec.modelId,
    dimensions: spec.dimensions,
    corpusSize: corpus.length,
    modelRepo: spec.repo,
    modelRevision: spec.revision,
    dtype: spec.dtype,
    queryPrefix: spec.queryPrefix,
    documentFormat: spec.documentFormat,
    dataCommit: await dataCommit(),
    corpusSha256: corpusHash(corpus),
    probes,
    entries: corpus.map((entry, i) => ({
      slug: entry.slug,
      vector: embedder.encode(vectors[i]),
    })),
  };
  EmbeddingsFileSchema.parse(file);
  await fs.mkdir(path.dirname(output), { recursive: true });
  const text = JSON.stringify(file);
  await fs.writeFile(output, text);
  // biome-ignore lint/suspicious/noConsole: CLI progress output
  console.log(
    `Written ${output}; ${((performance.now() - started) / 1000).toFixed(1)}s; ${Buffer.byteLength(text)} bytes; corpus ${file.corpusSha256}`
  );
}
main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: CLI error output
  console.error(error);
  process.exitCode = 1;
});
