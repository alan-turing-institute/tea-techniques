/**
 * The in-process embedding model: MiniLM-L12 through Transformers.js and ONNX Runtime.
 * Only the stdio server and the generation script use it; the HTTP service never loads it.
 * The packages are optional dependencies, so loading fails soft when they are absent.
 */
import { fileURLToPath } from 'node:url';
import { IN_PROCESS_MODEL } from './specs.js';

export const MODEL_ID = IN_PROCESS_MODEL.modelId;
export const MODEL_REVISION = IN_PROCESS_MODEL.revision;
export const EMBEDDING_PRECISION = IN_PROCESS_MODEL.dtype;
export const EMBEDDING_DIMENSIONS = IN_PROCESS_MODEL.dimensions;
export const QUERY_PREFIX = IN_PROCESS_MODEL.queryPrefix;

interface ExtractorOutput {
  data: Float32Array;
  dims: number[];
}
export type Extractor = (
  texts: string[],
  options: { pooling: 'mean' | 'none' | 'cls'; normalize: boolean }
) => Promise<ExtractorOutput>;

let loading: Promise<Extractor | null> | undefined;

/**
 * Loads the model once. Files come from `EMBEDDING_CACHE_DIR` (default
 * `mcp-server/.cache/huggingface`); missing files are downloaded unless
 * `allowDownload` is false or `TEA_OFFLINE=1`.
 */
export function getEmbeddingModel(
  options: { allowDownload?: boolean } = {}
): Promise<Extractor | null> {
  loading ??= loadModel(options.allowDownload !== false);
  return loading;
}

async function loadModel(allowDownload: boolean): Promise<Extractor | null> {
  try {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.cacheDir =
      process.env.EMBEDDING_CACHE_DIR ??
      fileURLToPath(new URL('../../.cache/huggingface', import.meta.url));
    env.allowLocalModels = true;
    env.localModelPath = env.cacheDir;
    env.allowRemoteModels = allowDownload && process.env.TEA_OFFLINE !== '1';
    // The revision is pinned in the download URL rather than through the `revision`
    // option, which would store some files under a revision directory that offline
    // loading does not look in.
    env.remotePathTemplate = `{model}/resolve/${IN_PROCESS_MODEL.revision}/`;
    const extractor = await pipeline(
      'feature-extraction',
      IN_PROCESS_MODEL.repo,
      {
        dtype: 'fp32',
        device: 'cpu',
        local_files_only: !env.allowRemoteModels,
      }
    );
    return (texts, options) =>
      extractor(texts, options) as unknown as Promise<ExtractorOutput>;
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: diagnostics to stderr
    console.error(
      `${MODEL_ID} model unavailable:`,
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
      pooling: 'mean',
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
