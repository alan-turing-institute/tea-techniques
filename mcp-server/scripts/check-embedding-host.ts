/**
 * The search check: embeds the catalogue file's probe sentences (with its query
 * prefix) through a host and compares each result with the vector the build made.
 * A host passes when every probe, including the long one, reaches the threshold.
 *
 *   tsx scripts/check-embedding-host.ts --embeddings=vectors/embeddings.qwen3.json \
 *     --host=ollama --model=qwen3-embedding:4b [--ollama-url=http://localhost:11434] [--threshold=0.999]
 *   tsx scripts/check-embedding-host.ts --embeddings=... --host=openrouter --model=qwen/qwen3-embedding-4b
 *
 * Exits 1 when any probe is below the threshold.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  EmbeddingsFileSchema,
  readStoredVector,
} from '../src/embedding/types.js';
import { cosine, embedWithOllama, embedWithOpenRouter } from './embed-hosts.js';

const args = process.argv.slice(2);
const arg = (key: string, fallback: string) =>
  args.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) ??
  fallback;

async function main(): Promise<void> {
  const file = EmbeddingsFileSchema.parse(
    JSON.parse(
      await fs.readFile(
        path.resolve(arg('embeddings', 'vectors/embeddings.qwen3.json')),
        'utf8'
      )
    )
  );
  const host = arg('host', '');
  const model = arg('model', '');
  const threshold = Number(arg('threshold', '0.999'));
  if (
    !(file.probes?.length && model && ['ollama', 'openrouter'].includes(host))
  ) {
    throw new Error(
      'Needs a file with probes, --model, and --host=ollama|openrouter'
    );
  }
  const texts = file.probes.map((p) => `${file.queryPrefix ?? ''}${p.text}`);
  const vectors =
    host === 'ollama'
      ? await embedWithOllama(
          arg('ollama-url', 'http://localhost:11434'),
          model,
          texts
        )
      : (await embedWithOpenRouter(model, texts)).vectors;
  let lowest = 1;
  for (const [i, probe] of file.probes.entries()) {
    const expected = readStoredVector(probe.vector, file.dimensions);
    if (!expected || vectors[i].length !== file.dimensions) {
      throw new Error(`Probe ${i + 1}: wrong vector length from the host`);
    }
    const score = cosine(expected, vectors[i]);
    lowest = Math.min(lowest, score);
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(
      `probe ${i + 1} (${probe.text.length} chars): cosine ${score.toFixed(7)}`
    );
  }
  const passed = lowest >= threshold;
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(
    `${host} ${model}: lowest ${lowest.toFixed(7)} against ${threshold}: ${passed ? 'pass' : 'FAIL'}`
  );
  process.exitCode = passed ? 0 : 1;
}
main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: CLI error output
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
