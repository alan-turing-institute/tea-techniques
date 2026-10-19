import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGraphData } from '../src/data/loader.js';
import { loadEmbeddings } from '../src/embedding/loader.js';
import { embedQuery, getEmbeddingModel } from '../src/embedding/model.js';
import { CATALOGUE_MODEL, IN_PROCESS_MODEL } from '../src/embedding/specs.js';
import { KnowledgeGraph } from '../src/graph/index.js';
import { embedWithOpenRouter } from './embed-hosts.js';

import { loadCases, unknownSlugs } from './evaluation/cases.js';
import { compareReportFiles } from './evaluation/compare.js';
import { formatComparison, formatReport } from './evaluation/printing.js';
import {
  type ClaimEvaluation,
  type EvaluationReport,
  evaluateCase,
  evaluateClaim,
  summarize,
} from './evaluation/scoring.js';

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);
const args = process.argv.slice(2);
const arg = (key: string, fallback: string) =>
  args.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) ??
  fallback;
const USE_CATALOGUE_MODEL = arg('model', 'minilm') === 'qwen3';
const OPENROUTER_QUERIES = arg('queries', '') === 'openrouter';
const DATA_DIR = path.resolve(
  arg('data-dir', path.join(PROJECT_ROOT, 'public/data'))
);
const CASES_DIR = path.resolve(
  arg('cases-dir', path.join(PROJECT_ROOT, 'mcp-server/evaluation/cases'))
);
// biome-ignore lint/suspicious/noConsole: CLI output
const log = console.log.bind(console);
async function writeReport(filename: string, report: unknown) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, `${JSON.stringify(report, null, 2)}\n`);
  log(`Report written to: ${filename}`);
}
async function compare(): Promise<void> {
  if (
    !(args[1] && args[2]) ||
    args[1].startsWith('--') ||
    args[2].startsWith('--')
  ) {
    throw new Error(
      'Usage: evaluate.ts compare <a.json> <b.json> [--output=…]'
    );
  }
  const comparison = await compareReportFiles(args[1], args[2]);
  log(formatComparison(comparison));
  if (arg('output', '')) {
    await writeReport(path.resolve(arg('output', '')), comparison);
  }
}

function validateOptions(): void {
  if (!['minilm', 'qwen3'].includes(arg('model', 'minilm'))) {
    throw new Error('Model must be minilm or qwen3');
  }
  if (!['', 'openrouter'].includes(arg('queries', ''))) {
    throw new Error('Queries must be openrouter or omitted');
  }
}

async function main(): Promise<void> {
  if (args[0] === 'compare') {
    await compare();
    return;
  }
  validateOptions();
  const cases = await loadCases(
    CASES_DIR,
    arg('case', '') ? arg('case', '').split(',') : undefined
  );
  const rubrics = cases.flatMap((item) => item.claims);
  const spec = USE_CATALOGUE_MODEL ? CATALOGUE_MODEL : IN_PROCESS_MODEL;
  const [graphData, embeddings] = await Promise.all([
    loadGraphData({ local: true, dataDir: DATA_DIR }),
    loadEmbeddings({ local: true, dataDir: DATA_DIR, expect: spec }),
  ]);
  if (!embeddings) {
    throw new Error(
      'Evaluation requires compatible embeddings; keyword fallback is not an embedding quality run'
    );
  }
  let queryVectors: number[][] | null = null;
  if (OPENROUTER_QUERIES) {
    const embedded = await embedWithOpenRouter(
      arg('openrouter-model', 'qwen/qwen3-embedding-4b'),
      rubrics.map((r) => `${spec.queryPrefix}${r.text}`)
    );
    queryVectors = embedded.vectors;
    // biome-ignore lint/suspicious/noConsole: CLI script output
    console.log(`OpenRouter query embeddings cost ${embedded.cost} credits`);
  } else {
    const model = await getEmbeddingModel();
    if (!(model && (await embedQuery(model, rubrics[0].text)))) {
      throw new Error(
        'Query model unavailable; cannot evaluate semantic retrieval'
      );
    }
  }
  const graph = new KnowledgeGraph(graphData, embeddings, undefined, {
    inProcessEmbedding: !queryVectors,
  });

  const known = new Set(
    graph.getAllTechniques().map((technique) => technique.slug)
  );
  const claims: ClaimEvaluation[] = [];
  for (const [i, rubric] of rubrics.entries()) {
    const started = performance.now();
    // biome-ignore lint/nursery/noAwaitInLoop: sequential evaluation intentional
    const results = await graph.suggestForClaim(rubric.text, {
      queryEmbedding: queryVectors
        ? { model: embeddings.modelId, vector: queryVectors[i] }
        : undefined,
    });
    const elapsedMs = Math.round(performance.now() - started);
    const returnedSlugs = results.results.map((t) => t.slug);

    claims.push(
      evaluateClaim(rubric, returnedSlugs, {
        rankingAvailable: results.rankingAvailable,
        semanticUsed: results.semanticUsed,
        elapsedMs,
      })
    );
  }
  let offset = 0;
  const evaluated = cases.map((rubric) => {
    const result = evaluateCase(
      rubric,
      claims.slice(offset, offset + rubric.claims.length),
      unknownSlugs(rubric, known)
    );
    offset += rubric.claims.length;
    return result;
  });
  const report: EvaluationReport = {
    schema: 1,
    timestamp: new Date().toISOString(),
    embeddingsLoaded: true,
    config: {
      embeddingModel: embeddings.modelId,
      querySource: OPENROUTER_QUERIES ? 'openrouter' : 'in-process',
      ...(OPENROUTER_QUERIES
        ? {
            openrouterModel: arg('openrouter-model', 'qwen/qwen3-embedding-4b'),
          }
        : {}),
      rankingEnabled: process.env.RANKING_ENABLED !== 'false',
      dataDirectory: DATA_DIR,
      casesDirectory: CASES_DIR,
    },
    cases: evaluated,
    overall: summarize(evaluated),
  };
  log(formatReport(report));
  await writeReport(
    path.resolve(
      arg(
        'output',
        path.join(PROJECT_ROOT, 'mcp-server/generated/evaluation.json')
      )
    ),
    report
  );
}
main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: CLI error output
  console.error('Evaluation failed:', error);
  process.exitCode = 1;
});
