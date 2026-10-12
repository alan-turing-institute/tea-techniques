import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IN_PROCESS_MODEL } from '../src/embedding/specs.js';

const transformers = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  pipeline: vi.fn(async (..._args: unknown[]) => async () => ({
    data: new Float32Array(1),
    dims: [1, 1],
  })),
}));
vi.mock('@huggingface/transformers', () => transformers);

/** Loads the in-process model with a fresh module, so each test sees the first load. */
async function load(options?: { allowDownload?: boolean }) {
  const { getEmbeddingModel } = await import('../src/embedding/model.js');
  return getEmbeddingModel(options);
}

beforeEach(() => {
  vi.resetModules();
  transformers.pipeline.mockClear();
  for (const key of Object.keys(transformers.env)) {
    delete transformers.env[key];
  }
});
afterEach(() => vi.unstubAllEnvs());

describe('in-process model download guards', () => {
  it('downloads on first use, from the pinned revision', async () => {
    vi.stubEnv('TEA_OFFLINE', '');
    expect(await load()).not.toBeNull();
    const [task, repo, options] = transformers.pipeline.mock.calls[0];
    expect(task).toBe('feature-extraction');
    expect(repo).toBe(IN_PROCESS_MODEL.repo);
    expect(transformers.env.allowRemoteModels).toBe(true);
    expect(options).toMatchObject({ local_files_only: false, dtype: 'fp32' });
    // The `revision` option would store files where offline loading does not look.
    expect(options).not.toHaveProperty('revision');
    expect(transformers.env.remotePathTemplate).toBe(
      `{model}/resolve/${IN_PROCESS_MODEL.revision}/`
    );
  });

  it('never downloads when TEA_OFFLINE is 1', async () => {
    vi.stubEnv('TEA_OFFLINE', '1');
    expect(await load()).not.toBeNull();
    expect(transformers.env.allowRemoteModels).toBe(false);
    expect(transformers.pipeline.mock.calls[0][2]).toMatchObject({
      local_files_only: true,
    });
  });

  it('never downloads when the caller forbids it', async () => {
    vi.stubEnv('TEA_OFFLINE', '');
    expect(await load({ allowDownload: false })).not.toBeNull();
    expect(transformers.env.allowRemoteModels).toBe(false);
    expect(transformers.pipeline.mock.calls[0][2]).toMatchObject({
      local_files_only: true,
    });
  });
});
