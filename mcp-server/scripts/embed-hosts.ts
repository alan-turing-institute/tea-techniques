/**
 * Embeds texts through a model host, the way a caller of the HTTP service does:
 * an Ollama server, or OpenRouter with a key read from a file and used only as a
 * bearer token. Used by the host check and the evaluation scripts.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/embeddings';
const DEFAULT_KEY_FILE = path.join(
  os.homedir(),
  '.config',
  'openrouter',
  'api-key'
);
const BATCH = 16;

export async function embedWithOllama(
  baseUrl: string,
  model: string,
  texts: string[]
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    // biome-ignore lint/nursery/noAwaitInLoop: batches run one after another against one local server
    const response = await fetch(new URL('/api/embed', baseUrl), {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: texts.slice(i, i + BATCH),
        keep_alive: '1m',
      }),
      signal: AbortSignal.timeout(900_000),
    });
    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }
    vectors.push(
      ...((await response.json()) as { embeddings: number[][] }).embeddings
    );
  }
  // Unload the model so only one is resident at a time.
  await fetch(new URL('/api/embed', baseUrl), {
    method: 'POST',
    redirect: 'error',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: '', keep_alive: 0 }),
  });
  return vectors;
}

export async function embedWithOpenRouter(
  model: string,
  texts: string[],
  keyFile = DEFAULT_KEY_FILE
): Promise<{ vectors: number[][]; cost: number }> {
  const key = (await fs.readFile(keyFile, 'utf8')).trim();
  const vectors: number[][] = [];
  let cost = 0;
  for (let i = 0; i < texts.length; i += BATCH) {
    // biome-ignore lint/nursery/noAwaitInLoop: batches run one after another to keep the spend visible
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: texts.slice(i, i + BATCH),
        encoding_format: 'float',
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      throw new Error(`OpenRouter HTTP ${response.status}`);
    }
    const body = (await response.json()) as {
      data: Array<{ index: number; embedding: number[] }>;
      usage?: { cost?: number };
    };
    vectors.push(
      ...[...body.data]
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding)
    );
    cost += body.usage?.cost ?? 0;
  }
  return { vectors, cost };
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / Math.sqrt(normA * normB);
}
