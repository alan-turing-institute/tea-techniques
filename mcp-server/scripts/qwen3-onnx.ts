/**
 * Qwen3-Embedding-4B at full precision (fp32) through onnxruntime-node, one text
 * at a time. The model directory is the `onnx-community/Qwen3-Embedding-4B-ONNX`
 * snapshot named by `CATALOGUE_MODEL.revision`: `model.onnx`, `model.onnx_data`,
 * `config.json` and the tokenizer files.
 *
 * Loading takes about 14 GB of memory, so this runs on a build host, never in the
 * service. The model's exported `sentence_embedding` output is used as is, with an
 * end-of-text token appended to each input if the tokenizer did not add one.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const END_OF_TEXT = 151_643;

/**
 * What the snapshot at `CATALOGUE_MODEL.revision` contains, from the repository's
 * LFS records: the SHA-256 of `model.onnx` (the graph, which names the offsets it reads
 * from `model.onnx_data`) and the exact size of `model.onnx_data` (16 GB, too slow to
 * hash on every run).
 */
export const CATALOGUE_SNAPSHOT = {
  graphSha256:
    '54f36c53f4b0573eae79d927b9f4ac24de38cb1ce67d90c2a398669b8b0977a0',
  dataBytes: 16_087_097_600,
};

/** Refuses a model directory that is not the pinned snapshot, so vectors never come from other weights. */
export async function assertCatalogueSnapshot(
  modelDir: string,
  expected = CATALOGUE_SNAPSHOT
): Promise<void> {
  const graph = await fs.readFile(path.join(modelDir, 'model.onnx'));
  if (
    createHash('sha256').update(graph).digest('hex') !== expected.graphSha256
  ) {
    throw new Error(
      `${modelDir}/model.onnx is not the pinned snapshot's graph (SHA-256 differs)`
    );
  }
  const { size } = await fs.stat(path.join(modelDir, 'model.onnx_data'));
  if (size !== expected.dataBytes) {
    throw new Error(
      `${modelDir}/model.onnx_data is ${size} bytes; the pinned snapshot's is ${expected.dataBytes}`
    );
  }
}

export type TextEmbedder = (text: string) => Promise<Float32Array>;

export async function loadQwen3(
  modelDir: string,
  threads: number
): Promise<TextEmbedder> {
  await assertCatalogueSnapshot(modelDir);
  const ort = await import('onnxruntime-node');
  const { AutoTokenizer, env } = await import('@huggingface/transformers');
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  const tokenizer = await AutoTokenizer.from_pretrained(modelDir, {
    local_files_only: true,
  });
  const session = await ort.InferenceSession.create(
    path.join(modelDir, 'model.onnx'),
    { executionProviders: ['cpu'], intraOpNumThreads: threads }
  );
  return async (text) => {
    const encoded = tokenizer(text, { truncation: false, padding: false });
    const ids = Array.from(encoded.input_ids.data as ArrayLike<bigint>, Number);
    if (ids.at(-1) !== END_OF_TEXT) {
      ids.push(END_OF_TEXT);
    }
    const shape = [1, ids.length];
    const output = await session.run({
      input_ids: new ort.Tensor(
        'int64',
        BigInt64Array.from(ids.map(BigInt)),
        shape
      ),
      attention_mask: new ort.Tensor(
        'int64',
        BigInt64Array.from(ids.map(() => 1n)),
        shape
      ),
    });
    return Float32Array.from(output.sentence_embedding.data as Float32Array);
  };
}
