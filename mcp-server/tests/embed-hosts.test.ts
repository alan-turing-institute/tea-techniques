import { afterEach, describe, expect, it, vi } from 'vitest';
import { embedWithOpenRouter } from '../scripts/embed-hosts.js';

const okResponse = () =>
  new Response(
    JSON.stringify({ data: [{ index: 0, embedding: [1, 2] }], usage: {} }),
    { status: 200 }
  );

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('embedWithOpenRouter key setting', () => {
  it.each([
    ['unset', undefined],
    ['blank', '   '],
  ])('rejects without a request when the setting is %s', async (_, value) => {
    vi.stubEnv('OPENROUTER_API_KEY', value);
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);

    await expect(embedWithOpenRouter('m', ['a'])).rejects.toThrow(
      'OPENROUTER_API_KEY'
    );
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('sends the trimmed key as a bearer token', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '  test-key  ');
    const fetchStub = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchStub);

    await embedWithOpenRouter('m', ['a']);

    const init = fetchStub.mock.calls[0][1] as unknown as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-key'
    );
  });
});
