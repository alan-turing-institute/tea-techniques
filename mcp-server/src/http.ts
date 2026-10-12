#!/usr/bin/env node
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadGraphData } from './data/loader.js';
import { loadEmbeddings } from './embedding/loader.js';
import { getEmbeddingModel, MODEL_ID } from './embedding/model.js';
import { KnowledgeGraph } from './graph/index.js';
import { RANKING_MODEL } from './ranking/clef.js';
import { createServer } from './server.js';

/** Stateless Streamable HTTP: one MCP server/transport per request, shared immutable catalogue. */
export function createHttpServer(
  graph: KnowledgeGraph,
  dataVersion: string
): http.Server {
  return http.createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/healthz' && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          ok: true,
          embeddingModel: MODEL_ID,
          rankingModel: RANKING_MODEL,
          rankingAvailable: await graph.rankingAvailable(),
          lastRankingSucceeded: graph.lastRankingSucceeded() ?? null,
          dataVersion,
        })
      );
      return;
    }
    if (pathname !== '/mcp') {
      response.writeHead(404).end();
      return;
    }
    if (request.method !== 'POST') {
      response.writeHead(405, { Allow: 'POST' }).end();
      return;
    }
    normalizeAcceptHeader(request);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = createServer(graph);
    response.on('close', () => {
      server.close().catch(() => {
        // Ignore close errors after the response has ended.
      });
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(request, response);
    } catch {
      if (!response.headersSent) {
        response
          .writeHead(500, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ error: 'MCP request failed' }));
      }
      await server.close();
    }
  });
}

// The SDK checks for both media types even when JSON responses are enabled.
// This endpoint only returns JSON; normalize JSON-only callers internally.
function normalizeAcceptHeader(request: http.IncomingMessage): void {
  const accept = request.headers.accept ?? '';
  if (
    !accept.includes('application/json') ||
    accept.includes('text/event-stream')
  ) {
    return;
  }
  request.headers.accept = `${accept}, text/event-stream`;
  // The SDK's Node-to-Web adapter reconstructs headers from rawHeaders.
  for (let i = 0; i < request.rawHeaders.length; i += 2) {
    if (request.rawHeaders[i].toLowerCase() === 'accept') {
      request.rawHeaders[i + 1] = request.headers.accept;
    }
  }
}

async function main(): Promise<void> {
  const dataDir = path.resolve(
    process.env.DATA_DIR ??
      fileURLToPath(new URL('../../public/data', import.meta.url))
  );
  const [data, embeddings] = await Promise.all([
    loadGraphData({ local: true, dataDir }),
    loadEmbeddings({ local: true, dataDir }),
  ]);
  if (process.env.TEA_OFFLINE === '1' && !embeddings) {
    throw new Error('Offline image requires valid EmbeddingGemma 2 embeddings');
  }
  if (process.env.TEA_OFFLINE === '1' && !(await getEmbeddingModel())) {
    throw new Error('Offline image requires the cached ONNX query model');
  }
  const version = await fs
    .readFile(path.join(dataDir, 'data-version'), 'utf8')
    .catch(() => 'local-unversioned');
  const server = createHttpServer(
    new KnowledgeGraph(data, embeddings),
    version.trim()
  );
  const port = Number(process.env.PORT ?? 3100);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('Invalid PORT');
  }
  server.listen(port, process.env.HOST ?? '127.0.0.1', () =>
    // biome-ignore lint/suspicious/noConsole: startup logging to stderr
    console.error(`MCP HTTP listening on port ${port}`)
  );
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      server.close();
      server.closeAllConnections();
    });
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    // biome-ignore lint/suspicious/noConsole: error logging to stderr
    console.error('Fatal error:', error);
    process.exitCode = 1;
  });
}
