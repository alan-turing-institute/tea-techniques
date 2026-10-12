#!/usr/bin/env node
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadGraphData } from './data/loader.js';
import { loadEmbeddings } from './embedding/loader.js';
import { CATALOGUE_MODEL } from './embedding/specs.js';
import { KnowledgeGraph } from './graph/index.js';
import {
  ClefRanker,
  noopRanker,
  RANKING_MODEL,
  type Ranker,
} from './ranking/clef.js';
import { createServer } from './server.js';

/**
 * The service runs no model of its own. Ranking is off when `RANKING_ENABLED` is
 * `false` (the image's default), and then no ranking backend is ever contacted.
 */
export function createRanker(): Ranker {
  return process.env.RANKING_ENABLED === 'false'
    ? noopRanker
    : new ClefRanker();
}

/**
 * Loads the catalogue and its vectors. The embedding model is never loaded: the
 * semantic leg uses vectors supplied with each request. Offline start-up needs
 * the vectors but no model files. Vectors made from a different corpus than the
 * graph's are refused, because their slugs would no longer describe the texts
 * they were made from.
 */
export async function loadRuntime(
  dataDir: string
): Promise<{ graph: KnowledgeGraph; dataVersion: string }> {
  const [data, embeddings] = await Promise.all([
    loadGraphData({ local: true, dataDir }),
    loadEmbeddings({ local: true, dataDir, expect: CATALOGUE_MODEL }),
  ]);
  if (process.env.TEA_OFFLINE === '1' && !embeddings) {
    throw new Error('Offline image requires valid embeddings');
  }
  const version = await fs
    .readFile(path.join(dataDir, 'data-version'), 'utf8')
    .catch(() => 'local-unversioned');
  const graph = new KnowledgeGraph(data, embeddings, createRanker(), {
    inProcessEmbedding: false,
  });
  if (embeddings && graph.embeddingsCorpusHash() !== graph.corpusHash()) {
    throw new Error(
      'Embeddings were not made from this graph: the corpus hash differs. Regenerate the vectors or use the graph they were made from'
    );
  }
  return { graph, dataVersion: version.trim() };
}

function sendJson(
  response: http.ServerResponse,
  status: number,
  body: unknown
): void {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

/** Reads only service state: the vectors' model comes from the file, ranking is not probed unless enabled. */
async function serveHealth(
  graph: KnowledgeGraph,
  dataVersion: string,
  response: http.ServerResponse
): Promise<void> {
  sendJson(response, 200, {
    ok: true,
    embeddingModel: graph.embeddingModelId(),
    rankingModel: RANKING_MODEL,
    rankingAvailable: await graph.rankingAvailable(),
    lastRankingSucceeded: graph.lastRankingSucceeded() ?? null,
    dataVersion,
  });
}

/** What a client needs to embed questions compatibly, with the build-time probe vectors. */
function serveEmbeddingSpec(
  graph: KnowledgeGraph,
  dataVersion: string,
  response: http.ServerResponse
): void {
  const spec = graph.embeddingSpec();
  if (!spec) {
    sendJson(response, 404, { error: 'No embedding spec is available' });
    return;
  }
  sendJson(response, 200, {
    modelId: spec.modelId,
    dimensions: spec.dimensions,
    queryPrefix: spec.queryPrefix,
    documentFormat: spec.documentFormat,
    dataVersion,
    probes: spec.probes,
  });
}

/** Largest request body the service reads. A call carrying a 2,560-number vector is about 6 KB. */
export const MAX_REQUEST_BYTES = 256 * 1024;

/**
 * Collects the body, counting bytes as they arrive. Resolves null as soon as the
 * body exceeds the limit; the rest of it is read and thrown away, never buffered.
 */
function readBody(request: http.IncomingMessage): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    request.on('data', (chunk: Buffer) => {
      if (settled) {
        return;
      }
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        settled = true;
        chunks.length = 0;
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks));
      }
    });
    for (const event of ['error', 'close'] as const) {
      request.on(event, () => {
        if (!settled) {
          settled = true;
          reject(new Error('Request ended before its body did'));
        }
      });
    }
  });
}

/**
 * The request's JSON body, read within the size limit. Answers 413 for a body over
 * the limit (by its declared length, or by the bytes actually received) and 400 for
 * one that is not JSON, and returns null in both cases.
 */
async function readJsonBody(
  request: http.IncomingMessage,
  response: http.ServerResponse
): Promise<{ value: unknown } | null> {
  const declared = Number(request.headers['content-length']);
  const body = declared > MAX_REQUEST_BYTES ? null : await readBody(request);
  if (!body) {
    sendJson(response, 413, { error: 'Request body too large' });
    request.resume();
    return null;
  }
  try {
    return { value: JSON.parse(body.toString('utf8')) };
  } catch {
    sendJson(response, 400, {
      jsonrpc: '2.0',
      error: {
        code: -32_700,
        message: 'Parse error: the body is not valid JSON',
      },
      id: null,
    });
    return null;
  }
}

async function serveMcp(
  graph: KnowledgeGraph,
  request: http.IncomingMessage,
  response: http.ServerResponse
): Promise<void> {
  if (request.method !== 'POST') {
    response.writeHead(405, { Allow: 'POST' }).end();
    return;
  }
  let body: { value: unknown } | null;
  try {
    body = await readJsonBody(request, response);
  } catch {
    return; // The client went away before sending its body.
  }
  if (!body) {
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
    await transport.handleRequest(request, response, body.value);
  } catch {
    if (!response.headersSent) {
      response
        .writeHead(500, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: 'MCP request failed' }));
    }
    await server.close();
  }
}

/** Stateless Streamable HTTP: one MCP server/transport per request, shared immutable catalogue. */
export function createHttpServer(
  graph: KnowledgeGraph,
  dataVersion: string
): http.Server {
  return http.createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/healthz' && request.method === 'GET') {
      await serveHealth(graph, dataVersion, response);
    } else if (pathname === '/embedding-spec' && request.method === 'GET') {
      serveEmbeddingSpec(graph, dataVersion, response);
    } else if (pathname === '/mcp') {
      await serveMcp(graph, request, response);
    } else {
      response.writeHead(404).end();
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
  const { graph, dataVersion } = await loadRuntime(dataDir);
  if (process.argv.includes('--check')) {
    // Image builds run the start-up checks without listening.
    // biome-ignore lint/suspicious/noConsole: startup logging to stderr
    console.error(`Data check passed (${dataVersion})`);
    return;
  }
  const server = createHttpServer(graph, dataVersion);
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
