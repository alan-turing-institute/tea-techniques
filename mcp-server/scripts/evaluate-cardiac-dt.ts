/**
 * Cardiac digital twin (PAH) evaluation script.
 *
 * Runs 5 evidence-gap claims from a cardiac digital twin assurance case
 * through suggestForClaim() and grades results against a hand-curated rubric.
 * Writes JSON report to data/claims/.cardiac-dt-evaluation.json.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGraphData } from '../src/data/loader.js';
import { KnowledgeGraph } from '../src/graph/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CLAIMS_DIR = path.join(PROJECT_ROOT, 'data', 'claims');
const DATA_DIR = path.join(PROJECT_ROOT, 'public', 'data');
const REPORT_PATH = path.join(CLAIMS_DIR, '.cardiac-dt-evaluation.json');

// --- Rubric ---

interface ClaimRubric {
  id: string;
  text: string;
  good: string[];
  acceptable: string[];
  bad: string[];
}

// Techniques that are clearly wrong for a lumped-parameter physics model.
// NN-specific, tree-specific, linear-model-specific, or topically irrelevant.
const NN_SPECIFIC = [
  'deeplift',
  'layer-wise-relevance-propagation',
  'gradient-weighted-class-activation-mapping',
  'integrated-gradients',
  'saliency-maps',
  'contextual-decomposition',
  'taylor-decomposition',
  'attention-visualisation-in-transformers',
  'neuron-activation-analysis',
  'concept-activation-vectors',
  'monte-carlo-dropout',
  'out-of-distribution-detector-for-neural-networks',
  'adversarial-debiasing',
  'causal-mediation-analysis-in-language-models',
  'chain-of-thought-faithfulness-evaluation',
];
const TREE_SPECIFIC = ['mean-decrease-impurity'];
const LINEAR_SPECIFIC = ['coefficient-magnitudes-in-linear-models'];
const ARCHITECTURE_BAD = [...NN_SPECIFIC, ...TREE_SPECIFIC, ...LINEAR_SPECIFIC];

// Fairness techniques irrelevant to physics model validation.
const FAIRNESS_IRRELEVANT = [
  'equalised-odds-post-processing',
  'reweighing',
  'reject-option-classification',
  'prejudice-remover-regulariser',
  'calibration-with-equality-of-opportunity',
  'sensitivity-analysis-for-fairness',
  'adversarial-debiasing',
];

const RUBRIC: ClaimRubric[] = [
  {
    id: 'P1.2',
    text: 'The model correctly represents right ventricle-pulmonary artery coupling behaviour across the range of disease severities observed in the target PAH population.',
    good: [
      'cross-validation',
      'bootstrapping',
      'sobol-indices',
      'prediction-intervals',
    ],
    acceptable: [
      'conformal-prediction',
      'jackknife-resampling',
      'permutation-importance',
      'partial-dependence-plots',
      'quantile-regression',
      'empirical-calibration',
    ],
    bad: [...ARCHITECTURE_BAD, ...FAIRNESS_IRRELEVANT],
  },
  {
    id: 'P2.2',
    text: 'The calibration process converges reliably across the target patient population, including patients at different disease stages and with varying data availability.',
    good: [
      'cross-validation',
      'bootstrapping',
      'empirical-calibration',
      'prediction-intervals',
      'conformal-prediction',
      'jackknife-resampling',
      'sobol-indices',
    ],
    acceptable: [
      'confidence-thresholding',
      'quantile-regression',
      'deep-ensembles',
    ],
    bad: [...ARCHITECTURE_BAD, ...FAIRNESS_IRRELEVANT],
  },
  {
    id: 'P3.2',
    text: 'The model identifies when predictions may be unreliable, detecting out-of-distribution inputs or calibration failures and flagging them to the clinician.',
    good: [
      'anomaly-detection',
      'conformal-prediction',
      'confidence-thresholding',
      'prediction-intervals',
      'runtime-monitoring-and-circuit-breakers',
      'epistemic-uncertainty-quantification',
    ],
    acceptable: [
      'red-teaming',
      'jackknife-resampling',
      'bootstrapping',
      'quantile-regression',
      'out-of-domain-detection',
    ],
    bad: [...ARCHITECTURE_BAD, ...FAIRNESS_IRRELEVANT],
  },
  {
    id: 'P4.1',
    text: 'Model outputs are interpretable and actionable for clinicians, presenting predictions in formats aligned with established clinical practice for PAH management.',
    good: [
      'human-in-the-loop-safeguards',
      'model-cards',
      'automated-documentation-generation',
    ],
    acceptable: [
      'prediction-intervals',
      'partial-dependence-plots',
      'sobol-indices',
      'local-interpretable-model-agnostic-explanations',
      'empirical-calibration',
      'internal-review-boards',
      'shapley-additive-explanations',
    ],
    bad: [
      ...NN_SPECIFIC,
      ...TREE_SPECIFIC,
      ...LINEAR_SPECIFIC,
      ...FAIRNESS_IRRELEVANT,
      'prompt-injection-testing',
      'jailbreak-resistance-testing',
      'prompt-robustness-testing',
    ],
  },
  {
    id: 'P4.2',
    text: 'The system has been validated against relevant clinical endpoints for PAH management, demonstrating that model-guided assessments correlate with patient outcomes.',
    good: [
      'cross-validation',
      'bootstrapping',
      'area-under-precision-recall-curve',
      'prediction-intervals',
      'empirical-calibration',
    ],
    acceptable: [
      'conformal-prediction',
      'jackknife-resampling',
      'sobol-indices',
      'shapley-additive-explanations',
      'permutation-importance',
    ],
    bad: [
      ...NN_SPECIFIC,
      ...TREE_SPECIFIC,
      ...LINEAR_SPECIFIC,
      ...FAIRNESS_IRRELEVANT,
      'data-version-control',
      'synthetic-data-generation',
      'agent-goal-misalignment-testing',
    ],
  },
];

// --- Grading ---

function scoreToGrade(score: number): string {
  if (score >= 8) {
    return 'A';
  }
  if (score >= 6) {
    return 'A-';
  }
  if (score >= 4) {
    return 'B+';
  }
  if (score >= 2) {
    return 'B';
  }
  if (score >= 0) {
    return 'B-';
  }
  if (score >= -2) {
    return 'C+';
  }
  if (score >= -4) {
    return 'C';
  }
  return 'D';
}

function scoreTechnique(slug: string, rubric: ClaimRubric): 1 | 0 | -1 {
  if (rubric.good.includes(slug)) {
    return 1;
  }
  if (rubric.bad.includes(slug)) {
    return -1;
  }
  // Acceptable and unlisted techniques both score 0.
  // Only explicitly bad techniques (architecture-specific, topically irrelevant) penalise.
  return 0;
}

// --- Types ---

interface ClaimEvaluation {
  id: string;
  text: string;
  returnedSlugs: string[];
  scores: Array<{ slug: string; score: 1 | 0 | -1 }>;
  totalScore: number;
  grade: string;
}

interface EvaluationReport {
  timestamp: string;
  claims: ClaimEvaluation[];
  summary: {
    averageScore: number;
    grades: Record<string, string>;
  };
}

// --- Helpers ---

// Build lookup: claim id → set of acceptable slugs (for display markers).
const ACCEPTABLE_LOOKUP = new Map(
  RUBRIC.map((r) => [r.id, new Set(r.acceptable)])
);

function getMarker(claimId: string, slug: string, score: 1 | 0 | -1): string {
  if (score === 1) {
    return '  +';
  }
  if (score === -1) {
    return '  -';
  }
  const acceptable = ACCEPTABLE_LOOKUP.get(claimId);
  return acceptable?.has(slug) ? '  ~' : '  .';
}

function printReport(
  claims: ClaimEvaluation[],
  grades: Record<string, string>,
  scoreSum: number
): void {
  // biome-ignore lint/suspicious/noConsole: CLI script output
  const log = console.log.bind(console);

  log('');
  log('Cardiac Digital Twin (PAH) — Claims Evaluation');
  log('================================================');
  log('  Legend: + good, ~ acceptable, . neutral, - bad');
  log('');

  for (const claim of claims) {
    log(`${claim.id}: ${claim.grade}  (score: ${claim.totalScore})`);
    log(`  "${claim.text.slice(0, 80)}..."`);
    log('  Top 10 results:');
    for (const s of claim.scores) {
      log(`  ${getMarker(claim.id, s.slug, s.score)} ${s.slug}`);
    }
    log('');
  }

  log('Summary');
  log('-------');
  for (const [id, grade] of Object.entries(grades)) {
    log(`  ${id}: ${grade}`);
  }
  log(`  Average score: ${(scoreSum / claims.length).toFixed(1)}`);
  log('');
  log(`Report written to: ${REPORT_PATH}`);
}

// --- Main ---

async function main(): Promise<void> {
  const graphData = await loadGraphData({ local: true, dataDir: DATA_DIR });
  const graph = new KnowledgeGraph(graphData);

  const claims: ClaimEvaluation[] = [];

  for (const rubric of RUBRIC) {
    const results = graph.suggestForClaim(rubric.text);
    const returnedSlugs = results.map((t) => t.slug);

    const scores = returnedSlugs.map((slug) => ({
      slug,
      score: scoreTechnique(slug, rubric),
    }));

    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);

    claims.push({
      id: rubric.id,
      text: rubric.text,
      returnedSlugs,
      scores,
      totalScore,
      grade: scoreToGrade(totalScore),
    });
  }

  const grades: Record<string, string> = {};
  let scoreSum = 0;
  for (const claim of claims) {
    grades[claim.id] = claim.grade;
    scoreSum += claim.totalScore;
  }

  const report: EvaluationReport = {
    timestamp: new Date().toISOString(),
    claims,
    summary: {
      averageScore: scoreSum / claims.length,
      grades,
    },
  };

  await fs.mkdir(CLAIMS_DIR, { recursive: true });
  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
  printReport(claims, grades, scoreSum);
}

main().catch((err) => {
  // biome-ignore lint/suspicious/noConsole: CLI script error output
  console.error('Evaluation failed:', err);
  process.exit(1);
});
