/** Text-only EmbeddingGemma 2 ONNX inference with the model's projected sentence embedding. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TechniqueNode } from '../graph/types.js';
export const MODEL_ID = 'onnx-community/embeddinggemma-2-ONNX';
export const MODEL_REVISION = 'daa72c51243991dfcaf9f9137d2c573d8f7790c0';
export const EMBEDDING_PRECISION = 'q8';
export const EMBEDDING_DIMENSIONS = 768;
export const QUERY_PREFIX = 'task: search result | query: ';
export const DOCUMENT_FORMAT = 'title: {title} | text: {content}';
interface ExtractorOutput {
  data: Float32Array;
  dims: number[];
}
export type Extractor = (
  texts: string[],
  options: { pooling: 'mean' | 'none' | 'cls'; normalize: boolean }
) => Promise<ExtractorOutput>;

let loading: Promise<Extractor | null> | undefined;
export function getEmbeddingModel(
  options: { allowDownload?: boolean } = {}
): Promise<Extractor | null> {
  loading ??= loadModel(options.allowDownload === true);
  return loading;
}
async function loadModel(allowDownload: boolean): Promise<Extractor | null> {
  try {
    const { AutoConfig, AutoModel, AutoTokenizer, env } = await import(
      '@huggingface/transformers'
    );
    env.cacheDir =
      process.env.EMBEDDING_CACHE_DIR ??
      fileURLToPath(new URL('../../.cache/huggingface-q8', import.meta.url));
    env.allowLocalModels = true;
    env.localModelPath = env.cacheDir;
    env.allowRemoteModels = allowDownload && process.env.TEA_OFFLINE !== '1';
    const options = {
      revision: MODEL_REVISION,
      local_files_only: !env.allowRemoteModels,
    };
    // Transformers.js tokenizer discovery ignores revision for Hub IDs. Use the
    // exact cached directory when offline so discovery never queries Hub metadata.
    const source = env.allowRemoteModels
      ? MODEL_ID
      : path.join(env.cacheDir, MODEL_ID, MODEL_REVISION);
    const config = await AutoConfig.from_pretrained(source, options);
    // All corpus entries are text. Do not load the image/audio encoders.
    Object.assign(config, { vision_config: null, audio_config: null });
    const [model, tokenizer] = await Promise.all([
      AutoModel.from_pretrained(source, {
        ...options,
        config,
        dtype: EMBEDDING_PRECISION,
        device: 'cpu',
      }),
      AutoTokenizer.from_pretrained(source, options),
    ]);
    return async (texts) => {
      const output = await model(
        tokenizer(texts, { padding: true, truncation: true, max_length: 8192 })
      );
      // Use the exported sentence output, preserving its learned pooling and projection.
      const sentence = output.sentence_embedding;
      if (
        !sentence ||
        sentence.dims.length !== 2 ||
        sentence.dims[0] !== texts.length ||
        sentence.dims[1] !== EMBEDDING_DIMENSIONS
      ) {
        throw new Error('Invalid sentence embedding dimensions');
      }
      const data = new Float32Array(sentence.data);
      if (!data.every((v) => Number.isFinite(v))) {
        throw new Error('Non-finite embedding');
      }
      for (let i = 0; i < texts.length; i++) {
        const offset = i * EMBEDDING_DIMENSIONS;
        const norm = Math.sqrt(
          data
            .slice(offset, offset + EMBEDDING_DIMENSIONS)
            .reduce((sum, v) => sum + v * v, 0)
        );
        if (!norm) {
          throw new Error('Zero embedding');
        }
        for (let j = 0; j < EMBEDDING_DIMENSIONS; j++) {
          data[offset + j] /= norm;
        }
      }
      return { data, dims: [texts.length, EMBEDDING_DIMENSIONS] };
    };
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: diagnostics to stderr
    console.error(
      'EmbeddingGemma 2 model unavailable:',
      error instanceof Error ? error.message : 'load failed'
    );
    return null;
  }
}
export async function embedQuery(
  model: Extractor,
  text: string
): Promise<Float32Array | null> {
  try {
    const output = await model([`${QUERY_PREFIX}${text}`], {
      pooling: 'none',
      normalize: true,
    });
    return output.data.slice(0, output.dims[1]);
  } catch {
    // biome-ignore lint/suspicious/noConsole: diagnostics to stderr
    console.error(
      'Query embedding unavailable; falling back to keyword retrieval'
    );
    return null;
  }
}
export async function batchEmbed(
  model: Extractor,
  texts: string[],
  batchSize = 8
): Promise<Float32Array[]> {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('Invalid batch size');
  }
  const vectors: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    // biome-ignore lint/nursery/noAwaitInLoop: batches run sequentially to bound memory
    const output = await model(batch, { pooling: 'mean', normalize: true });
    for (let j = 0; j < batch.length; j++) {
      vectors.push(
        output.data.slice(j * output.dims[1], (j + 1) * output.dims[1])
      );
    }
  }
  return vectors;
}
export function buildCorpus(
  techniques: TechniqueNode[]
): Array<{ text: string; slug: string }> {
  return techniques.flatMap((t) =>
    [t.description, ...t.sampleClaims.map((c) => c.text)].map((content) => ({
      text: `title: ${t.name} | text: ${content}`,
      slug: t.slug,
    }))
  );
}
