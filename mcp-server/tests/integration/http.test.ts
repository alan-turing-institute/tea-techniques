import type http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { KnowledgeGraph } from '../../src/graph/index.js';
import type { JsonLdGraph } from '../../src/graph/types.js';
import { createHttpServer } from '../../src/http.js';
import fixture from '../fixtures/test-graph.json' with { type: 'json' };

let server: http.Server;
let base: string;
beforeAll(async () => {
  server = createHttpServer(
    new KnowledgeGraph(fixture as unknown as JsonLdGraph),
    'test-cut'
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
it('returns health metadata without a ranking model', async () => {
  expect(await (await fetch(`${base}/healthz`)).json()).toMatchObject({
    ok: true,
    rankingAvailable: false,
    dataVersion: 'test-cut',
  });
});
it('completes MCP initialization, listing and tool calls over Streamable HTTP', async () => {
  const client = new Client({ name: 'http-test', version: '1' });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`))
    );
    expect((await client.listTools()).tools).toHaveLength(10);
    const result = await client.callTool({
      name: 'suggest_techniques_for_claim',
      arguments: { claim: 'explain model decisions' },
    });
    const body = result.structuredContent as {
      rankingAvailable: boolean;
      results: Array<{ retrievalScore: number; score: number }>;
    };
    expect(body.rankingAvailable).toBe(false);
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results.every((t) => t.score === t.retrievalScore)).toBe(true);
    expect(body.results.every((t) => !('reason' in t))).toBe(true);
  } finally {
    await client.close();
  }
});
it('returns 404 and 405 for unsupported paths/methods', async () => {
  expect((await fetch(`${base}/unknown`)).status).toBe(404);
  expect((await fetch(`${base}/mcp`)).status).toBe(405);
});
it('accepts a direct tools/call with JSON-only Accept and no initialization', async () => {
  const response = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'suggest_techniques_for_claim',
        arguments: { claim: 'explain model predictions' },
      },
    }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toContain('application/json');
  expect(response.headers.has('Mcp-Session-Id')).toBe(false);
  const body = await response.json();
  expect(body.result.structuredContent.results.length).toBeGreaterThan(0);
});
