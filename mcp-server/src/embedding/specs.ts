/**
 * The two embedding models the package knows about, and how each embeds text.
 *
 * - `CATALOGUE_MODEL` made the vectors the HTTP service serves. The service
 *   never runs it: callers embed their questions with it elsewhere and send
 *   the vector. Its weights are too large to run in-process on a typical machine.
 * - `IN_PROCESS_MODEL` is small enough to run in the stdio server, which embeds
 *   questions itself when the caller sends no vector.
 */

/** Catalogue entries are embedded as `title: {name} | text: {content}`, with no prefix. */
export const DOCUMENT_FORMAT = 'title: {title} | text: {content}';

export interface EmbeddingModelSpec {
  /** Identity a caller must send as `queryEmbedding.model`. */
  modelId: string;
  /** Repository the weights come from. */
  repo: string;
  revision: string;
  dtype: string;
  dimensions: number;
  /** Prepended to a question before it is embedded; documents carry no prefix. */
  queryPrefix: string;
  documentFormat: string;
}

export const CATALOGUE_MODEL: EmbeddingModelSpec = {
  modelId: 'Qwen/Qwen3-Embedding-4B',
  repo: 'onnx-community/Qwen3-Embedding-4B-ONNX',
  revision: '7d046e08591811ddd93dfe815b1d3bfccb16c041',
  dtype: 'fp32',
  dimensions: 2560,
  queryPrefix:
    'Instruct: Given an AI assurance claim, retrieve the assurance techniques that can produce evidence to support or test the claim\nQuery:',
  documentFormat: DOCUMENT_FORMAT,
};

export const IN_PROCESS_MODEL: EmbeddingModelSpec = {
  modelId: 'Xenova/all-MiniLM-L12-v2',
  repo: 'Xenova/all-MiniLM-L12-v2',
  revision: 'beeb2e4b69e95f188a15cc2e90d09fd035dac229',
  dtype: 'fp32',
  dimensions: 384,
  queryPrefix: '',
  documentFormat: DOCUMENT_FORMAT,
};
