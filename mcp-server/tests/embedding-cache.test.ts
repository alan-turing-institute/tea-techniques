import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IN_PROCESS_MODEL } from '../src/embedding/specs.js';

const { modelId, dimensions } = IN_PROCESS_MODEL;
const vector = (value: number) =>
  Array.from({ length: dimensions }, () => value);
/** The published file in the current format. */
const current = (slug: string) => ({
  modelId,
  modelRepo: IN_PROCESS_MODEL.repo,
  modelRevision: IN_PROCESS_MODEL.revision,
  dtype: IN_PROCESS_MODEL.dtype,
  queryPrefix: IN_PROCESS_MODEL.queryPrefix,
  documentFormat: IN_PROCESS_MODEL.documentFormat,
  dimensions,
  corpusSize: 1,
  entries: [{ slug, vector: vector(0.05) }],
});
/** What release 0.1.1 cached: the model id and the vectors, with none of the metadata. */
const stripped = (slug: string) => ({
  modelId,
  dimensions,
  corpusSize: 1,
  entries: [{ slug, vector: vector(0.05) }],
});

let home: string;
let cacheFile: string;
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'mcpfree-home-'));
  cacheFile = path.join(
    home,
    '.cache',
    'tea-techniques-mcp',
    'embeddings.json'
  );
  await fs.mkdir(path.dirname(cacheFile), { recursive: true });
  // The loader reads the home directory when it is imported.
  vi.resetModules();
  vi.stubEnv('HOME', home);
  vi.stubEnv('TEA_OFFLINE', '');
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await fs.rm(home, { recursive: true });
});

async function load(remote: unknown) {
  const fetchSpy = vi.fn(async () => Response.json(remote));
  vi.stubGlobal('fetch', fetchSpy);
  const { loadEmbeddings } = await import('../src/embedding/loader.js');
  return { index: await loadEmbeddings({}), fetchSpy };
}

describe('cached published vectors', () => {
  it('are replaced by a fresh copy when the cached file is from an earlier release', async () => {
    await fs.writeFile(cacheFile, JSON.stringify(stripped('old')));
    const { index, fetchSpy } = await load(current('fresh'));
    expect(index?.slugs).toEqual(['fresh']);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(
      JSON.parse(await fs.readFile(cacheFile, 'utf8')).entries[0].slug
    ).toBe('fresh');
  });

  it('are used without a fetch when the cached file is current', async () => {
    await fs.writeFile(cacheFile, JSON.stringify(current('cached')));
    const { index, fetchSpy } = await load(current('fresh'));
    expect(index?.slugs).toEqual(['cached']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
