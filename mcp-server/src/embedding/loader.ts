/**
 * Load pre-computed embeddings from local files or remote URL with caching.
 *
 * Mirrors the pattern in src/data/loader.ts.
 * Returns null on failure (graceful degradation to keyword-only pipeline).
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type EmbeddingModelSpec, IN_PROCESS_MODEL } from './specs.js';
import type {
  EmbeddingProbe,
  EmbeddingsFile,
  EmbeddingsIndex,
} from './types.js';
import { EmbeddingsFileSchema, readStoredVector } from './types.js';

const REMOTE_URL =
  'https://alan-turing-institute.github.io/tea-techniques/data/ld/embeddings.json';
if (!REMOTE_URL.startsWith('https://')) {
  throw new Error('REMOTE_URL must use HTTPS');
}

const FETCH_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_CHARS = 50 * 1024 * 1024; // 50M chars

const CACHE_DIR = path.join(os.homedir(), '.cache', 'tea-techniques-mcp');
const CACHE_FILE = path.join(CACHE_DIR, 'embeddings.json');
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Reads a validated file as an index, refusing a file made by a model other than `expect`. */
function toIndex(
  file: EmbeddingsFile,
  expect: EmbeddingModelSpec
): EmbeddingsIndex {
  if (
    file.modelId !== expect.modelId ||
    file.dimensions !== expect.dimensions ||
    file.modelRevision !== expect.revision ||
    file.dtype !== expect.dtype ||
    file.queryPrefix !== expect.queryPrefix ||
    file.documentFormat !== expect.documentFormat
  ) {
    throw new Error(
      `Embedding model mismatch: file ${file.modelId}/${file.dimensions}, expected ${expect.modelId}/${expect.dimensions}`
    );
  }
  const slugs: string[] = [];
  const vectors: Float32Array[] = [];
  for (const entry of file.entries) {
    const vector = readStoredVector(entry.vector, file.dimensions);
    if (!vector) {
      throw new Error('Embedding vector invalid');
    }
    slugs.push(entry.slug);
    vectors.push(vector);
  }
  const probes: EmbeddingProbe[] = [];
  for (const probe of file.probes ?? []) {
    const vector = readStoredVector(probe.vector, file.dimensions);
    if (!vector) {
      throw new Error('Embedding probe vector invalid');
    }
    probes.push({ text: probe.text, vector: Array.from(vector) });
  }
  return {
    modelId: file.modelId,
    dimensions: file.dimensions,
    slugs,
    vectors,
    queryPrefix: file.queryPrefix,
    documentFormat: file.documentFormat,
    ...(file.corpusSha256 ? { corpusSha256: file.corpusSha256 } : {}),
    ...(probes.length ? { probes } : {}),
  };
}

async function isCacheValid(): Promise<boolean> {
  try {
    const stat = await fs.stat(CACHE_FILE);
    return Date.now() - stat.mtimeMs < CACHE_MAX_AGE_MS;
  } catch {
    return false;
  }
}

async function readCache(): Promise<EmbeddingsFile | null> {
  try {
    const content = await fs.readFile(CACHE_FILE, 'utf-8');
    return EmbeddingsFileSchema.parse(JSON.parse(content)) as EmbeddingsFile;
  } catch {
    // biome-ignore lint/suspicious/noConsole: cache diagnostics to stderr
    console.error(`Cache invalid or unreadable (${CACHE_FILE}), will re-fetch`);
    return null;
  }
}

async function writeCache(data: EmbeddingsFile): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(data));
}

async function fetchRemote(): Promise<EmbeddingsFile> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(REMOTE_URL, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch embeddings: ${response.status} ${response.statusText}`
      );
    }
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_RESPONSE_CHARS) {
      throw new Error(`Response Content-Length too large: ${contentLength}`);
    }
    const text = await response.text();
    if (text.length > MAX_RESPONSE_CHARS) {
      throw new Error(`Response too large: ${text.length} chars`);
    }
    return EmbeddingsFileSchema.parse(JSON.parse(text)) as EmbeddingsFile;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadFromLocal(dataDir: string): Promise<EmbeddingsFile> {
  const filePath = path.join(dataDir, 'ld', 'embeddings.json');
  const content = await fs.readFile(filePath, 'utf-8');
  return EmbeddingsFileSchema.parse(JSON.parse(content)) as EmbeddingsFile;
}

/**
 * The cached vectors as an index, or null when there is no usable cache: none,
 * older than a day, unreadable, or made by another model (such as the metadata-less
 * file an earlier release cached), in which case the caller fetches a fresh copy.
 */
async function loadFromCache(
  expect: EmbeddingModelSpec
): Promise<EmbeddingsIndex | null> {
  if (!(await isCacheValid())) {
    return null;
  }
  const cached = await readCache();
  if (!cached) {
    return null;
  }
  try {
    const index = toIndex(cached, expect);
    // biome-ignore lint/suspicious/noConsole: startup logging to stderr
    console.error(
      `Loaded embeddings from cache: ${CACHE_FILE} (${cached.corpusSize} entries)`
    );
    return index;
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: startup logging to stderr
    console.error(
      `Cached embeddings unusable (${error instanceof Error ? error.message : 'invalid file'}), will re-fetch`
    );
    return null;
  }
}

/**
 * Load embeddings, returning null on failure (graceful degradation). The file
 * must have been made by `expect`, which defaults to the in-process model.
 */
export async function loadEmbeddings(options: {
  local?: boolean;
  dataDir?: string;
  expect?: EmbeddingModelSpec;
}): Promise<EmbeddingsIndex | null> {
  const expect = options.expect ?? IN_PROCESS_MODEL;
  try {
    if (
      process.env.TEA_OFFLINE === '1' &&
      !(options.local && options.dataDir)
    ) {
      throw new Error('Offline mode requires local embeddings');
    }
    let file: EmbeddingsFile;

    if (options.local && options.dataDir) {
      file = await loadFromLocal(options.dataDir);
      // biome-ignore lint/suspicious/noConsole: startup logging to stderr
      console.error(
        `Loaded embeddings from local: ${options.dataDir}/ld/embeddings.json (${file.corpusSize} entries)`
      );
      return toIndex(file, expect);
    }

    // Remote mode: check cache first
    const cachedIndex = await loadFromCache(expect);
    if (cachedIndex) {
      return cachedIndex;
    }

    // Fetch from remote
    // biome-ignore lint/suspicious/noConsole: startup logging to stderr
    console.error(`Fetching embeddings from: ${REMOTE_URL}`);
    file = await fetchRemote();
    const index = toIndex(file, expect);
    await writeCache(file);
    // biome-ignore lint/suspicious/noConsole: startup logging to stderr
    console.error(
      `Cached embeddings to: ${CACHE_FILE} (${file.corpusSize} entries)`
    );
    return index;
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: startup logging to stderr
    console.error(
      `Embeddings unavailable — falling back to keyword-only pipeline: ${error instanceof Error ? error.message : 'invalid file'}`
    );
    return null;
  }
}
