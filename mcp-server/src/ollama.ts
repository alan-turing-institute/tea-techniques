/** The only inference service used at request time is the local Ollama daemon. */
export function ollamaUrl(endpoint: string): string {
  const base = new URL(process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434');
  if (
    base.protocol !== 'http:' ||
    ![
      'localhost',
      '127.0.0.1',
      '[::1]',
      'ollama',
      'host.docker.internal',
    ].includes(base.hostname)
  ) {
    throw new Error(
      'OLLAMA_URL must be a local HTTP daemon, the Compose ollama service, or host.docker.internal'
    );
  }
  return new URL(endpoint, base).href;
}
