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
    let reply: Reply | undefined;
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
        const received = { status: response.statusCode ?? 0, body: '' };
        reply = received;
        response.on('data', (chunk) => {
          received.body += chunk;
        });
        response.on('end', () => resolve(received));
      }
    );
    request.on('error', (error: NodeJS.ErrnoException) => {
      // The server can close the socket after replying while we are still writing.
      if (reply && (error.code === 'EPIPE' || error.code === 'ECONNRESET')) {
        resolve(reply);
      } else {
        reject(error);
      }
    });
    async function sendBody() {
      // Let the client read an early reply before queueing the entire oversized body.
      for (const chunk of chunks) {
        for (let offset = 0; offset < chunk.length; offset += 16 * 1024) {
          if (reply || request.destroyed) {
            return;
          }
          request.write(chunk.subarray(offset, offset + 16 * 1024));
          // biome-ignore lint/nursery/noAwaitInLoop: pace writes so socket reads can run between them
          await new Promise<void>((resume) => setTimeout(resume, 10));
        }
      }
      request.end();
    }
    sendBody().catch(reject);
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

  it('answers 400 to a batch of calls and keeps serving', async () => {
    const call = JSON.parse(
      callOf({ claim: 'explain model predictions' }).toString()
    );
    const reply = await post([Buffer.from(JSON.stringify([call, call]))], true);
    expect(reply.status).toBe(400);
    expect(JSON.parse(reply.body)).toEqual({
      jsonrpc: '2.0',
      error: { code: -32_600, message: 'Batch requests are not supported' },
      id: null,
    });
    expect(await healthz()).toBe(200);
  });

  it('still answers a call carrying a realistic 2,560-number vector and a long claim', async () => {
    const vector = Array.from({ length: 2560 }, () => Math.random() * 2 - 1);
    const body = callOf({
      claim: 'The model identifies unreliable predictions. '.repeat(44),
      queryEmbedding: { model: 'any', vector },
    });
    // A real call is tens of kilobytes, well inside the limit but far above a toy one.
    expect(body.length).toBeGreaterThan(50_000);
    expect(body.length).toBeLessThan(MAX_REQUEST_BYTES);
    const reply = await post([body], true);
    expect(reply.status).toBe(200);
    expect(JSON.parse(reply.body).result.structuredContent.semanticUsed).toBe(
      false
    );
  });

  it('answers 413 while the body is still being sent, and closes the connection', async () => {
    // The body is never ended: a 413 here proves the server decided from the bytes
    // received so far, and the socket closing proves it released the connection.
    const outcome = await new Promise<{
      status: number;
      connection: string | undefined;
    }>((resolve, reject) => {
      let answered: number | undefined;
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              answered
                ? `Answered ${answered} but kept the connection open`
                : 'No answer while the body was open'
            )
          ),
        4000
      );
      const request = http.request(
        {
          port,
          host: '127.0.0.1',
          method: 'POST',
          path: '/mcp',
          headers: { 'Content-Type': 'application/json' },
        },
        (response) => {
          answered = response.statusCode ?? 0;
          const connection = response.headers.connection;
          response.resume();
          response.socket.once('close', () => {
            clearTimeout(timer);
            resolve({ status: answered ?? 0, connection });
          });
        }
      );
      request.on('error', () => {
        // The server may reset the connection once it has answered.
      });
      request.write(Buffer.alloc(300 * 1024, 'x'));
    });
    expect(outcome).toEqual({ status: 413, connection: 'close' });
    expect(await healthz()).toBe(200);
  });
});
