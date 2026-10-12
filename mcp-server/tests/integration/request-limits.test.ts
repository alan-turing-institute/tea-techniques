import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KnowledgeGraph } from '../../src/graph/index.js';
import type { JsonLdGraph } from '../../src/graph/types.js';
import { createHttpServer, MAX_REQUEST_BYTES } from '../../src/http.js';
import fixture from '../fixtures/test-graph.json' with { type: 'json' };

let server: http.Server;
let port: number;
beforeAll(async () => {
  server = createHttpServer(
    new KnowledgeGraph(fixture as unknown as JsonLdGraph),
    'test-cut'
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as { port: number }).port;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

interface Reply {
  status: number;
  body: string;
}

/** Posts `chunks` to /mcp; without a content length the body is sent chunked. */
function post(chunks: Buffer[], declareLength: boolean): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        port,
        host: '127.0.0.1',
        method: 'POST',
        path: '/mcp',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(declareLength
            ? { 'Content-Length': chunks.reduce((n, c) => n + c.length, 0) }
            : {}),
        },
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, body })
        );
      }
    );
    request.on('error', reject);
    for (const chunk of chunks) {
      request.write(chunk);
    }
    request.end();
  });
}

const callOf = (arguments_: object) =>
  Buffer.from(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'suggest_techniques_for_claim', arguments: arguments_ },
    })
  );
const healthz = async () =>
  (await fetch(`http://127.0.0.1:${port}/healthz`)).status;

describe('request size limit on /mcp', () => {
  it('answers 413 to a 1 MB body and keeps serving', async () => {
    const big = callOf({
      claim: 'explain model predictions',
      padding: 'x'.repeat(1_000_000),
    });
    const reply = await post([big], true);
    expect(reply.status).toBe(413);
    expect(big.length).toBeGreaterThan(MAX_REQUEST_BYTES);
    expect(await healthz()).toBe(200);
  });

  it('counts the bytes of a chunked body that declares no length', async () => {
    const chunk = Buffer.alloc(64 * 1024, 'x');
    const reply = await post(
      Array.from({ length: 16 }, () => chunk),
      false
    );
    expect(reply.status).toBe(413);
    expect(await healthz()).toBe(200);
  });

  it('answers 400 with a fixed message to a body that is not JSON', async () => {
    const reply = await post([Buffer.from('{"jsonrpc":')], true);
    expect(reply.status).toBe(400);
    expect(JSON.parse(reply.body)).toEqual({
      jsonrpc: '2.0',
      error: {
        code: -32_700,
        message: 'Parse error: the body is not valid JSON',
      },
      id: null,
    });
  });

  it('still answers a call carrying a 2,560-number vector', async () => {
    const vector = Array.from({ length: 2560 }, (_, i) => (i === 0 ? 1 : 0));
    const body = callOf({
      claim: 'explain model predictions',
      queryEmbedding: { model: 'any', vector },
    });
    expect(body.length).toBeLessThan(MAX_REQUEST_BYTES);
    const reply = await post([body], true);
    expect(reply.status).toBe(200);
    expect(JSON.parse(reply.body).result.structuredContent.semanticUsed).toBe(
      false
    );
  });
});
