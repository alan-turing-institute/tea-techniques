/**
 * Claims cross-validation baseline script.
 *
 * For each claim in data/claims/*.json, calls suggestForClaim() and checks
 * whether the source technique appears in the top-10 results. Writes a JSON
 * report to data/claims/.validation-report.json and a human-readable summary
 * to stderr.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGraphData } from '../src/data/loader.js';
import {
  buildAutoExclusions,
  extractConceptTags,
  inferGoals,
  KnowledgeGraph,
} from '../src/graph/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CLAIMS_DIR = path.join(PROJECT_ROOT, 'data', 'claims');
const DATA_DIR = path.join(PROJECT_ROOT, 'public', 'data');
const REPORT_PATH = path.join(CLAIMS_DIR, '.validation-report.json');

// --- Types ---

interface ClaimFile {
  slug: string;
  name: string;
  claims: Array<{
    text: string;
    domain: string;
    assuranceGoal: string;
  }>;
}

interface ClaimResult {
  slug: string;
  claimText: string;
  domain: string;
  assuranceGoal: string;
  rank: number | null;
  matchPath: 'concept-tag' | 'fuse-fallback' | 'not-found';
  inferredGoals: string[];
  conceptTags: string[];
  autoExclusions: string[];
  returnedSlugs: string[];
}

interface TechniqueReport {
  slug: string;
  name: string;
  totalClaims: number;
  foundTop1: number;
  foundTop5: number;
  foundTop10: number;
  claims: ClaimResult[];
}

interface ValidationReport {
  timestamp: string;
  totalTechniques: number;
  totalClaims: number;
  aggregate: {
    top1: number;
    top5: number;
    top10: number;
  };
  matchPathBreakdown: {
    conceptTag: number;
    fuseFallback: number;
    notFound: number;
  };
  byGoal: Record<string, { total: number; foundTop10: number }>;
  worstTechniques: Array<{
    slug: string;
    name: string;
    foundTop10: number;
    totalClaims: number;
  }>;
  techniques: TechniqueReport[];
}

interface Aggregates {
  totalClaims: number;
  top1: number;
  top5: number;
  top10: number;
  conceptTagCount: number;
  fuseFallbackCount: number;
  notFoundCount: number;
  byGoal: Record<string, { total: number; foundTop10: number }>;
}

// --- Helpers ---

async function loadClaimsFiles(): Promise<ClaimFile[]> {
  const entries = await fs.readdir(CLAIMS_DIR);
  const jsonFiles = entries.filter(
    (f) => f.endsWith('.json') && !f.startsWith('.')
  );

  const files = await Promise.all(
    jsonFiles.map(async (file) => {
      const content = await fs.readFile(path.join(CLAIMS_DIR, file), 'utf-8');
      return JSON.parse(content) as ClaimFile;
    })
  );
  return files;
}

function determineMatchPath(
  claimText: string,
  sourceSlug: string,
  returnedSlugs: string[],
  graph: KnowledgeGraph
): 'concept-tag' | 'fuse-fallback' | 'not-found' {
  if (!returnedSlugs.includes(sourceSlug)) {
    return 'not-found';
  }

  const conceptTags = extractConceptTags(claimText);
  if (conceptTags.length === 0) {
    return 'fuse-fallback';
  }

  const technique = graph.getTechnique(sourceSlug);
  if (!technique) {
    return 'fuse-fallback';
  }

  const hasOverlap = conceptTags.some((concept) =>
    technique.tags.some((tag) => tag.toLowerCase().includes(concept))
  );

  return hasOverlap ? 'concept-tag' : 'fuse-fallback';
}

function updateAggregates(
  agg: Aggregates,
  rank: number | null,
  matchPath: ClaimResult['matchPath'],
  goal: string,
  techReport: TechniqueReport
): void {
  agg.totalClaims++;

  if (rank === 1) {
    agg.top1++;
    techReport.foundTop1++;
  }
  if (rank !== null && rank <= 5) {
    agg.top5++;
    techReport.foundTop5++;
  }
  if (rank !== null && rank <= 10) {
    agg.top10++;
    techReport.foundTop10++;
  }

  switch (matchPath) {
    case 'concept-tag':
      agg.conceptTagCount++;
      break;
    case 'fuse-fallback':
      agg.fuseFallbackCount++;
      break;
    default:
      agg.notFoundCount++;
      break;
  }

  if (!agg.byGoal[goal]) {
    agg.byGoal[goal] = { total: 0, foundTop10: 0 };
  }
  agg.byGoal[goal].total++;
  if (rank !== null && rank <= 10) {
    agg.byGoal[goal].foundTop10++;
  }
}

function evaluateClaims(
  claimsFiles: ClaimFile[],
  graph: KnowledgeGraph
): { techniqueReports: TechniqueReport[]; agg: Aggregates } {
  const agg: Aggregates = {
    totalClaims: 0,
    top1: 0,
    top5: 0,
    top10: 0,
    conceptTagCount: 0,
    fuseFallbackCount: 0,
    notFoundCount: 0,
    byGoal: {},
  };

  const techniqueReports: TechniqueReport[] = [];

  for (const file of claimsFiles) {
    const techReport: TechniqueReport = {
      slug: file.slug,
      name: file.name,
      totalClaims: file.claims.length,
      foundTop1: 0,
      foundTop5: 0,
      foundTop10: 0,
      claims: [],
    };

    for (const claim of file.claims) {
      const results = graph.suggestForClaim(claim.text);
      const returnedSlugs = results.map((t) => t.slug);
      const rankIndex = returnedSlugs.indexOf(file.slug);
      const rank = rankIndex >= 0 ? rankIndex + 1 : null;

      const matchPath = determineMatchPath(
        claim.text,
        file.slug,
        returnedSlugs,
        graph
      );

      techReport.claims.push({
        slug: file.slug,
        claimText: claim.text,
        domain: claim.domain,
        assuranceGoal: claim.assuranceGoal,
        rank,
        matchPath,
        inferredGoals: inferGoals(claim.text),
        conceptTags: extractConceptTags(claim.text),
        autoExclusions: buildAutoExclusions(inferGoals(claim.text)),
        returnedSlugs,
      });

      updateAggregates(agg, rank, matchPath, claim.assuranceGoal, techReport);
    }

    techniqueReports.push(techReport);
  }

  return { techniqueReports, agg };
}

function printSummary(
  agg: Aggregates,
  techniqueCount: number,
  worstTechniques: ValidationReport['worstTechniques']
): void {
  const pct = (n: number, d: number) =>
    d > 0 ? `${((n / d) * 100).toFixed(1)}%` : 'N/A';

  const { totalClaims } = agg;
  const lines = [
    '',
    'Claims Validation Baseline',
    '===========================',
    `Techniques: ${techniqueCount} | Claims: ${totalClaims}`,
    '',
    'Self-retrieval rates:',
    `  Top 1:  ${agg.top1}/${totalClaims} (${pct(agg.top1, totalClaims)})`,
    `  Top 5:  ${agg.top5}/${totalClaims} (${pct(agg.top5, totalClaims)})`,
    `  Top 10: ${agg.top10}/${totalClaims} (${pct(agg.top10, totalClaims)})`,
    '',
    'Match path breakdown:',
    `  Concept-tag:    ${agg.conceptTagCount} (${pct(agg.conceptTagCount, totalClaims)})`,
    `  Fuse fallback:  ${agg.fuseFallbackCount} (${pct(agg.fuseFallbackCount, totalClaims)})`,
    `  Not found:      ${agg.notFoundCount} (${pct(agg.notFoundCount, totalClaims)})`,
    '',
    'By assurance goal:',
  ];

  for (const [goal, counts] of Object.entries(agg.byGoal).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    lines.push(
      `  ${goal.padEnd(20)} ${counts.foundTop10}/${counts.total} found (${pct(counts.foundTop10, counts.total)})`
    );
  }

  lines.push('');
  lines.push(
    `Top ${worstTechniques.length} worst techniques (lowest self-retrieval):`
  );
  for (let i = 0; i < worstTechniques.length; i++) {
    const t = worstTechniques[i];
    lines.push(
      `  ${i + 1}. ${t.slug} (${t.foundTop10}/${t.totalClaims} claims found)`
    );
  }

  lines.push('');
  lines.push(`Report written to: ${REPORT_PATH}`);

  // biome-ignore lint/suspicious/noConsole: CLI script output
  console.error(lines.join('\n'));
}

// --- Main ---

async function main(): Promise<void> {
  const graphData = await loadGraphData({ local: true, dataDir: DATA_DIR });
  const graph = new KnowledgeGraph(graphData);
  const claimsFiles = await loadClaimsFiles();

  const { techniqueReports, agg } = evaluateClaims(claimsFiles, graph);

  const sortedByWorst = [...techniqueReports].sort(
    (a, b) =>
      a.foundTop10 / a.totalClaims - b.foundTop10 / b.totalClaims ||
      a.slug.localeCompare(b.slug)
  );

  const worstTechniques = sortedByWorst.slice(0, 10).map((t) => ({
    slug: t.slug,
    name: t.name,
    foundTop10: t.foundTop10,
    totalClaims: t.totalClaims,
  }));

  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    totalTechniques: claimsFiles.length,
    totalClaims: agg.totalClaims,
    aggregate: { top1: agg.top1, top5: agg.top5, top10: agg.top10 },
    matchPathBreakdown: {
      conceptTag: agg.conceptTagCount,
      fuseFallback: agg.fuseFallbackCount,
      notFound: agg.notFoundCount,
    },
    byGoal: agg.byGoal,
    worstTechniques,
    techniques: techniqueReports,
  };

  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
  printSummary(agg, claimsFiles.length, worstTechniques);
}

main().catch((err) => {
  // biome-ignore lint/suspicious/noConsole: CLI script error output
  console.error('Validation failed:', err);
  process.exit(1);
});
