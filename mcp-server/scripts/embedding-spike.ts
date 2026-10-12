/**
 * Embedding feasibility spike for suggestForClaim.
 *
 * Compares 4 embedding models (5 configs) across 5 evaluation scenarios
 * (21 claims) covering 4 domains, 4 model types, and all 7 assurance goals.
 *
 * Usage: cd mcp-server && pnpm embedding-spike
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from '@huggingface/transformers';
import { loadGraphData } from '../src/data/loader.js';
import { KnowledgeGraph } from '../src/graph/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'public', 'data');
const CLAIMS_DIR = path.join(PROJECT_ROOT, 'data', 'claims');
const REPORT_PATH = path.join(CLAIMS_DIR, '.embedding-spike-results.json');

// biome-ignore lint/suspicious/noConsole: CLI script output
const log = console.log.bind(console);

// ────────────────────────────────────────────
// Bad technique lists
// ────────────────────────────────────────────

const NN_SPECIFIC = [
  'deeplift',
  'layer-wise-relevance-propagation',
  'gradient-weighted-class-activation-mapping',
  'integrated-gradients',
  'gradient-saliency',
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

const LLM_SPECIFIC = [
  'prompt-injection-testing',
  'jailbreak-resistance-testing',
  'prompt-robustness-testing',
  'prompt-sensitivity-analysis',
  'hallucination-detection',
  'retrieval-augmented-generation-evaluation',
  'chain-of-thought-faithfulness-evaluation',
  'causal-mediation-analysis-in-language-models',
  'attention-visualisation-in-transformers',
  'toxicity-detection',
  'safety-guardrails',
  'few-shot-fairness-evaluation',
  'automated-documentation-generation',
];

const VISION_SPECIFIC = [
  'gradient-weighted-class-activation-mapping',
  'gradient-saliency',
];

const FAIRNESS_IRRELEVANT = [
  'equalised-odds-post-processing',
  'reweighing',
  'reject-option-classification',
  'prejudice-remover-regulariser',
  'calibration-with-equality-of-opportunity',
  'sensitivity-analysis-for-fairness',
  'adversarial-debiasing',
];

function badList(...lists: string[][]): string[] {
  return [...new Set(lists.flat())];
}

// ────────────────────────────────────────────
// Rubrics (5 scenarios, 21 claims)
// ────────────────────────────────────────────

interface ClaimRubric {
  id: string;
  scenario: string;
  text: string;
  good: string[];
  bad: string[];
}

const RUBRICS: ClaimRubric[] = [
  // --- Scenario 0: Cardiac Digital Twin (5 claims) ---
  {
    id: 'P1.2',
    scenario: 'Cardiac DT',
    text: 'The model correctly represents right ventricle-pulmonary artery coupling behaviour across the range of disease severities observed in the target PAH population.',
    good: [
      'cross-validation',
      'bootstrapping',
      'sobol-indices',
      'prediction-intervals',
    ],
    bad: badList(
      NN_SPECIFIC,
      TREE_SPECIFIC,
      LINEAR_SPECIFIC,
      FAIRNESS_IRRELEVANT
    ),
  },
  {
    id: 'P2.2',
    scenario: 'Cardiac DT',
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
    bad: badList(
      NN_SPECIFIC,
      TREE_SPECIFIC,
      LINEAR_SPECIFIC,
      FAIRNESS_IRRELEVANT
    ),
  },
  {
    id: 'P3.2',
    scenario: 'Cardiac DT',
    text: 'The model identifies when predictions may be unreliable, detecting out-of-distribution inputs or calibration failures and flagging them to the clinician.',
    good: [
      'anomaly-detection',
      'conformal-prediction',
      'confidence-thresholding',
      'prediction-intervals',
      'runtime-monitoring-and-circuit-breakers',
      'epistemic-uncertainty-quantification',
    ],
    bad: badList(
      NN_SPECIFIC,
      TREE_SPECIFIC,
      LINEAR_SPECIFIC,
      FAIRNESS_IRRELEVANT
    ),
  },
  {
    id: 'P4.1',
    scenario: 'Cardiac DT',
    text: 'Model outputs are interpretable and actionable for clinicians, presenting predictions in formats aligned with established clinical practice for PAH management.',
    good: [
      'human-in-the-loop-safeguards',
      'model-cards',
      'automated-documentation-generation',
    ],
    bad: badList(
      NN_SPECIFIC,
      TREE_SPECIFIC,
      LINEAR_SPECIFIC,
      FAIRNESS_IRRELEVANT,
      [
        'prompt-injection-testing',
        'jailbreak-resistance-testing',
        'prompt-robustness-testing',
      ]
    ),
  },
  {
    id: 'P4.2',
    scenario: 'Cardiac DT',
    text: 'The system has been validated against relevant clinical endpoints for PAH management, demonstrating that model-guided assessments correlate with patient outcomes.',
    good: [
      'cross-validation',
      'bootstrapping',
      'area-under-precision-recall-curve',
      'prediction-intervals',
      'empirical-calibration',
    ],
    bad: badList(
      NN_SPECIFIC,
      TREE_SPECIFIC,
      LINEAR_SPECIFIC,
      FAIRNESS_IRRELEVANT,
      [
        'data-version-control',
        'synthetic-data-generation',
        'agent-goal-misalignment-testing',
      ]
    ),
  },

  // --- Scenario 1: Credit Scoring (4 claims) ---
  {
    id: 'CS1.1',
    scenario: 'Credit Scoring',
    text: "Lending model treats applicants equitably regardless of protected characteristics, approval rates don't systematically differ across demographic groups.",
    good: [
      'demographic-parity-assessment',
      'equalised-odds-post-processing',
      'disparate-impact-remover',
      'sensitivity-analysis-for-fairness',
      'counterfactual-fairness-assessment',
    ],
    bad: badList(NN_SPECIFIC, LLM_SPECIFIC, VISION_SPECIFIC),
  },
  {
    id: 'CS1.2',
    scenario: 'Credit Scoring',
    text: 'Loan officer can understand why an application was declined and communicate key factors in plain language to the applicant.',
    good: [
      'shapley-additive-explanations',
      'local-interpretable-model-agnostic-explanations',
      'partial-dependence-plots',
      'permutation-importance',
      'mean-decrease-impurity',
    ],
    bad: badList(NN_SPECIFIC, LLM_SPECIFIC, VISION_SPECIFIC, LINEAR_SPECIFIC),
  },
  {
    id: 'CS1.3',
    scenario: 'Credit Scoring',
    text: 'Model performs consistently across economic conditions; risk estimates remain calibrated for new geographic regions.',
    good: [
      'cross-validation',
      'empirical-calibration',
      'bootstrapping',
      'prediction-intervals',
    ],
    bad: badList(NN_SPECIFIC, LLM_SPECIFIC, VISION_SPECIFIC),
  },
  {
    id: 'CS1.4',
    scenario: 'Credit Scoring',
    text: 'Model enforces intuitive relationships — higher income never increases predicted default probability.',
    good: [
      'monotonicity-constraints',
      'partial-dependence-plots',
      'shapley-additive-explanations',
    ],
    bad: badList(NN_SPECIFIC, LLM_SPECIFIC, VISION_SPECIFIC, LINEAR_SPECIFIC),
  },

  // --- Scenario 2: Customer Service Chatbot (4 claims) ---
  {
    id: 'CB2.1',
    scenario: 'Chatbot',
    text: 'Chatbot does not fabricate product information or policies; clearly indicates when it cannot find a definitive answer.',
    good: [
      'hallucination-detection',
      'retrieval-augmented-generation-evaluation',
      'confidence-thresholding',
      'epistemic-uncertainty-quantification',
    ],
    bad: badList(TREE_SPECIFIC, LINEAR_SPECIFIC, VISION_SPECIFIC),
  },
  {
    id: 'CB2.2',
    scenario: 'Chatbot',
    text: 'System cannot be manipulated into revealing internal prompts, bypassing content policies, or acting outside its intended role.',
    good: [
      'prompt-injection-testing',
      'jailbreak-resistance-testing',
      'red-teaming',
      'safety-guardrails',
    ],
    bad: badList(TREE_SPECIFIC, LINEAR_SPECIFIC, VISION_SPECIFIC),
  },
  {
    id: 'CB2.3',
    scenario: 'Chatbot',
    text: 'Responds consistently regardless of formal, colloquial, or non-native language; no offensive or biased replies.',
    good: [
      'toxicity-detection',
      'prompt-robustness-testing',
      'prompt-sensitivity-analysis',
      'few-shot-fairness-evaluation',
    ],
    bad: badList(TREE_SPECIFIC, LINEAR_SPECIFIC, VISION_SPECIFIC),
  },
  {
    id: 'CB2.4',
    scenario: 'Chatbot',
    text: 'Capabilities, limitations, training data sources, and failure modes documented for technical and non-technical stakeholders.',
    good: [
      'model-cards',
      'datasheets-for-datasets',
      'automated-documentation-generation',
      'model-development-audit-trails',
    ],
    bad: badList(TREE_SPECIFIC, LINEAR_SPECIFIC, VISION_SPECIFIC),
  },

  // --- Scenario 3: Medical Imaging (4 claims) ---
  {
    id: 'MI3.1',
    scenario: 'Medical Imaging',
    text: 'System highlights specific region of chest X-ray that led to suspected abnormality, allowing radiologist to verify reasoning.',
    good: [
      'gradient-weighted-class-activation-mapping',
      'gradient-saliency',
      'integrated-gradients',
      'layer-wise-relevance-propagation',
    ],
    bad: badList(TREE_SPECIFIC, LINEAR_SPECIFIC, LLM_SPECIFIC),
  },
  {
    id: 'MI3.2',
    scenario: 'Medical Imaging',
    text: 'System detects insufficient scan quality or artefacts and withholds findings rather than producing misleading results.',
    good: [
      'anomaly-detection',
      'confidence-thresholding',
      'out-of-distribution-detector-for-neural-networks',
      'runtime-monitoring-and-circuit-breakers',
    ],
    bad: badList(TREE_SPECIFIC, LINEAR_SPECIFIC, LLM_SPECIFIC),
  },
  {
    id: 'MI3.3',
    scenario: 'Medical Imaging',
    text: 'Consistent sensitivity across patient demographics (age, sex, ethnicity); no subgroup receives worse screening outcomes.',
    good: [
      'demographic-parity-assessment',
      'cross-validation',
      'sensitivity-analysis-for-fairness',
      'bootstrapping',
    ],
    bad: badList(TREE_SPECIFIC, LINEAR_SPECIFIC, LLM_SPECIFIC),
  },
  {
    id: 'MI3.4',
    scenario: 'Medical Imaging',
    text: 'Tested at operating boundaries: rare pathologies, paediatric imaging, portable bedside X-rays with lower quality.',
    good: [
      'safety-envelope-testing',
      'red-teaming',
      'cross-validation',
      'anomaly-detection',
    ],
    bad: badList(TREE_SPECIFIC, LINEAR_SPECIFIC, LLM_SPECIFIC),
  },

  // --- Scenario 4: Predictive Maintenance (4 claims) ---
  {
    id: 'PM4.1',
    scenario: 'Pred Maintenance',
    text: 'Maintenance alert explains which sensor readings and conditions contributed, so engineer can assess plausibility before scheduling shutdown.',
    good: [
      'shapley-additive-explanations',
      'permutation-importance',
      'mean-decrease-impurity',
      'partial-dependence-plots',
      'local-interpretable-model-agnostic-explanations',
    ],
    bad: badList(
      NN_SPECIFIC,
      LLM_SPECIFIC,
      VISION_SPECIFIC,
      FAIRNESS_IRRELEVANT
    ),
  },
  {
    id: 'PM4.2',
    scenario: 'Pred Maintenance',
    text: 'Time-to-failure estimate accompanied by uncertainty range, enabling informed scheduling rather than single point prediction.',
    good: [
      'prediction-intervals',
      'conformal-prediction',
      'quantile-regression',
      'bootstrapping',
    ],
    bad: badList(
      NN_SPECIFIC,
      LLM_SPECIFIC,
      VISION_SPECIFIC,
      FAIRNESS_IRRELEVANT
    ),
  },
  {
    id: 'PM4.3',
    scenario: 'Pred Maintenance',
    text: 'Training data, feature engineering, validation methodology, and limitations are documented and version-controlled for safety audits.',
    good: [
      'model-cards',
      'datasheets-for-datasets',
      'model-development-audit-trails',
      'data-version-control',
      'mlflow-experiment-tracking',
    ],
    bad: badList(
      NN_SPECIFIC,
      LLM_SPECIFIC,
      VISION_SPECIFIC,
      FAIRNESS_IRRELEVANT
    ),
  },
  {
    id: 'PM4.4',
    scenario: 'Pred Maintenance',
    text: 'System detects when sensor data deviates from training patterns (e.g., after equipment retrofit) and alerts that predictions may be less reliable.',
    good: [
      'anomaly-detection',
      'runtime-monitoring-and-circuit-breakers',
      'confidence-thresholding',
    ],
    bad: badList(
      NN_SPECIFIC,
      LLM_SPECIFIC,
      VISION_SPECIFIC,
      FAIRNESS_IRRELEVANT
    ),
  },
];

// ────────────────────────────────────────────
// Model configs
// ────────────────────────────────────────────

interface ModelConfig {
  id: string;
  name: string;
  queryPrefix: string | null;
}

const MODELS: ModelConfig[] = [
  { id: 'S1', name: 'Xenova/all-MiniLM-L6-v2', queryPrefix: null },
  { id: 'S2', name: 'Xenova/all-MiniLM-L12-v2', queryPrefix: null },
  { id: 'M1', name: 'Xenova/bge-small-en-v1.5', queryPrefix: null },
  {
    id: 'M1p',
    name: 'Xenova/bge-small-en-v1.5',
    queryPrefix: 'Represent this sentence for searching relevant passages: ',
  },
  { id: 'L1', name: 'Xenova/bge-m3', queryPrefix: null },
];

// ────────────────────────────────────────────
// Grading (same logic as evaluate-cardiac-dt)
// ────────────────────────────────────────────

function scoreTechnique(slug: string, rubric: ClaimRubric): 1 | 0 | -1 {
  if (rubric.good.includes(slug)) {
    return 1;
  }
  if (rubric.bad.includes(slug)) {
    return -1;
  }
  return 0;
}

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

function gradeTop10(
  slugs: string[],
  rubric: ClaimRubric
): { score: number; grade: string } {
  const top10 = slugs.slice(0, 10);
  const totalScore = top10.reduce(
    (sum, slug) => sum + scoreTechnique(slug, rubric),
    0
  );
  return { score: totalScore, grade: scoreToGrade(totalScore) };
}

// ────────────────────────────────────────────
// Corpus & embedding helpers
// ────────────────────────────────────────────

interface CorpusEntry {
  text: string;
  slug: string;
}

function buildCorpus(graph: KnowledgeGraph): CorpusEntry[] {
  const corpus: CorpusEntry[] = [];
  for (const t of graph.getAllTechniques()) {
    corpus.push({ text: `${t.name}: ${t.description}`, slug: t.slug });
    for (const claim of t.sampleClaims) {
      corpus.push({ text: claim.text, slug: t.slug });
    }
  }
  return corpus;
}

function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

// biome-ignore lint/suspicious/noExplicitAny: HF pipeline type not fully exported
type Extractor = any;

async function batchEmbed(
  extractor: Extractor,
  texts: string[],
  batchSize = 32
): Promise<Float32Array[]> {
  const vectors: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, Math.min(i + batchSize, texts.length));
    // biome-ignore lint/nursery/noAwaitInLoop: sequential batching intentional to avoid OOM
    const output = await extractor(batch, {
      pooling: 'mean',
      normalize: true,
    });
    const data = output.data as Float32Array;
    const dims = output.dims[1] as number;
    for (let j = 0; j < batch.length; j++) {
      vectors.push(data.slice(j * dims, (j + 1) * dims));
    }
  }
  return vectors;
}

function rankBySimilarity(
  queryVec: Float32Array,
  corpusVecs: Float32Array[],
  corpus: CorpusEntry[],
  topK = 10
): string[] {
  // Compute cosine similarity (= dot product since vectors are L2-normalised)
  const bestPerSlug = new Map<string, number>();
  for (let i = 0; i < corpusVecs.length; i++) {
    const sim = dotProduct(queryVec, corpusVecs[i]);
    const slug = corpus[i].slug;
    const existing = bestPerSlug.get(slug);
    if (existing === undefined || sim > existing) {
      bestPerSlug.set(slug, sim);
    }
  }

  return Array.from(bestPerSlug.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, topK)
    .map(([slug]) => slug);
}

// ────────────────────────────────────────────
// Reciprocal Rank Fusion
// ────────────────────────────────────────────

function computeRRF(rankings: string[][], k = 60, topK = 10): string[] {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    for (let i = 0; i < ranking.length; i++) {
      const slug = ranking[i];
      scores.set(slug, (scores.get(slug) ?? 0) + 1 / (k + i + 1));
    }
  }
  return Array.from(scores.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, topK)
    .map(([slug]) => slug);
}

// ────────────────────────────────────────────
// Result types
// ────────────────────────────────────────────

interface ClaimResult {
  id: string;
  scenario: string;
  currentScore: number;
  currentGrade: string;
  currentTop10: string[];
  embedScore: number;
  embedGrade: string;
  embedTop10: string[];
  hybridScore: number;
  hybridGrade: string;
  hybridTop10: string[];
}

interface ModelResult {
  modelId: string;
  modelName: string;
  queryPrefix: string | null;
  loadTimeMs: number;
  corpusEmbedTimeMs: number;
  avgQueryTimeMs: number;
  peakMemoryMB: number;
  claims: ClaimResult[];
}

// ────────────────────────────────────────────
// Reporting
// ────────────────────────────────────────────

function fmt(grade: string, score: number): string {
  const sign = score >= 0 ? '+' : '';
  return `${grade}(${sign}${score})`;
}

function printModelResults(result: ModelResult): void {
  const scenarios = [...new Set(result.claims.map((c) => c.scenario))];

  for (const scenario of scenarios) {
    const claims = result.claims.filter((c) => c.scenario === scenario);
    log('');
    log(`  Scenario: ${scenario}`);
    log(
      `  ${'Claim'.padEnd(8)} | ${'Current'.padEnd(10)} | ${'Embed'.padEnd(10)} | ${'Hybrid'.padEnd(10)}`
    );
    log(
      `  ${'─'.repeat(8)} | ${'─'.repeat(10)} | ${'─'.repeat(10)} | ${'─'.repeat(10)}`
    );
    for (const c of claims) {
      log(
        `  ${c.id.padEnd(8)} | ${fmt(c.currentGrade, c.currentScore).padEnd(10)} | ${fmt(c.embedGrade, c.embedScore).padEnd(10)} | ${fmt(c.hybridGrade, c.hybridScore).padEnd(10)}`
      );
    }
  }

  log('');
  log(
    `  Timing: load=${(result.loadTimeMs / 1000).toFixed(1)}s, corpus=${(result.corpusEmbedTimeMs / 1000).toFixed(1)}s, query=${result.avgQueryTimeMs.toFixed(0)}ms`
  );
  log(`  Memory delta: ~${result.peakMemoryMB.toFixed(0)}MB`);
}

function printSummary(results: ModelResult[]): void {
  log('');
  log('══════════════════════════════════════════════════════════════');
  log('OVERALL SUMMARY');
  log('══════════════════════════════════════════════════════════════');
  log('');

  // Model comparison table
  log(
    `${'Model'.padEnd(6)} | ${'Avg Cur'.padEnd(8)} | ${'Avg Emb'.padEnd(8)} | ${'Avg Hyb'.padEnd(8)} | ${'Emb Δ'.padEnd(7)} | ${'Hyb Δ'.padEnd(7)} | ${'Helps'.padEnd(5)} | Hurts`
  );
  log(
    `${'─'.repeat(6)} | ${'─'.repeat(8)} | ${'─'.repeat(8)} | ${'─'.repeat(8)} | ${'─'.repeat(7)} | ${'─'.repeat(7)} | ${'─'.repeat(5)} | ${'─'.repeat(5)}`
  );

  for (const r of results) {
    const n = r.claims.length;
    const avgCur = r.claims.reduce((s, c) => s + c.currentScore, 0) / n;
    const avgEmb = r.claims.reduce((s, c) => s + c.embedScore, 0) / n;
    const avgHyb = r.claims.reduce((s, c) => s + c.hybridScore, 0) / n;
    const embDelta = avgEmb - avgCur;
    const hybDelta = avgHyb - avgCur;
    let helps = 0;
    let hurts = 0;
    for (const c of r.claims) {
      if (c.hybridScore - c.currentScore >= 1) {
        helps++;
      }
      if (c.hybridScore - c.currentScore <= -1) {
        hurts++;
      }
    }

    const dFmt = (d: number) => `${d >= 0 ? '+' : ''}${d.toFixed(1)}`;
    log(
      `${r.modelId.padEnd(6)} | ${avgCur.toFixed(1).padEnd(8)} | ${avgEmb.toFixed(1).padEnd(8)} | ${avgHyb.toFixed(1).padEnd(8)} | ${dFmt(embDelta).padEnd(7)} | ${dFmt(hybDelta).padEnd(7)} | ${String(helps).padEnd(5)} | ${hurts}`
    );
  }

  // Timing summary
  log('');
  log('Timing Summary');
  log('──────────────');
  log(
    `${'Model'.padEnd(6)} | ${'Load'.padEnd(8)} | ${'Corpus'.padEnd(10)} | Avg Query`
  );
  log(
    `${'─'.repeat(6)} | ${'─'.repeat(8)} | ${'─'.repeat(10)} | ${'─'.repeat(10)}`
  );
  for (const r of results) {
    log(
      `${r.modelId.padEnd(6)} | ${`${(r.loadTimeMs / 1000).toFixed(1)}s`.padEnd(8)} | ${`${(r.corpusEmbedTimeMs / 1000).toFixed(1)}s`.padEnd(10)} | ${r.avgQueryTimeMs.toFixed(0)}ms`
    );
  }

  // Per-scenario hybrid averages
  if (results.length === 0) {
    return;
  }
  log('');
  log('Per-Scenario Average Hybrid Scores (Δ vs Current)');
  log('──────────────────────────────────────────────────');
  const scenarios = [...new Set(results[0].claims.map((c) => c.scenario))];
  const header = [
    'Scenario'.padEnd(16),
    ...results.map((r) => r.modelId.padEnd(12)),
  ].join(' | ');
  log(header);
  log(['─'.repeat(16), ...results.map(() => '─'.repeat(12))].join(' | '));
  for (const scenario of scenarios) {
    const cols = results.map((r) => {
      const claims = r.claims.filter((c) => c.scenario === scenario);
      const avg = claims.reduce((s, c) => s + c.hybridScore, 0) / claims.length;
      const avgCur =
        claims.reduce((s, c) => s + c.currentScore, 0) / claims.length;
      const delta = avg - avgCur;
      return `${avg.toFixed(1)}(${delta >= 0 ? '+' : ''}${delta.toFixed(1)})`.padEnd(
        12
      );
    });
    log(`${scenario.padEnd(16)} | ${cols.join(' | ')}`);
  }
}

function printGoNoGo(results: ModelResult[]): void {
  log('');
  log('══════════════════════════════════════════════════════════════');
  log('GO / NO-GO ASSESSMENT');
  log('══════════════════════════════════════════════════════════════');
  log('');

  log('Criteria:');
  log('  1. Total hybrid score improvement >= +2 across all 21 claims');
  log('  2. No scenario average degrades vs current pipeline');
  log('  3. At least 3 of the weak claims (C+ or worse) improve');
  log('');

  for (const r of results) {
    printModelGoNoGo(r);
  }

  printModelRecommendation(results);
}

function findDegradedScenarios(r: ModelResult): string[] {
  const scenarios = [...new Set(r.claims.map((c) => c.scenario))];
  const degraded: string[] = [];
  for (const scenario of scenarios) {
    const claims = r.claims.filter((c) => c.scenario === scenario);
    const avgCur =
      claims.reduce((s, c) => s + c.currentScore, 0) / claims.length;
    const avgHyb =
      claims.reduce((s, c) => s + c.hybridScore, 0) / claims.length;
    if (avgHyb < avgCur) {
      degraded.push(scenario);
    }
  }
  return degraded;
}

function isViable(r: ModelResult): boolean {
  const totalCur = r.claims.reduce((s, c) => s + c.currentScore, 0);
  const totalHyb = r.claims.reduce((s, c) => s + c.hybridScore, 0);
  return totalHyb - totalCur >= 2 && findDegradedScenarios(r).length === 0;
}

function printModelGoNoGo(r: ModelResult): void {
  const totalCur = r.claims.reduce((s, c) => s + c.currentScore, 0);
  const totalHyb = r.claims.reduce((s, c) => s + c.hybridScore, 0);
  const totalImprovement = totalHyb - totalCur;

  const degradedScenarios = findDegradedScenarios(r);

  const weakClaims = r.claims.filter((c) => c.currentScore <= 0);
  const weakImproved = weakClaims.filter(
    (c) => c.hybridScore > c.currentScore
  ).length;

  const criterion1 = totalImprovement >= 2;
  const criterion2 = degradedScenarios.length === 0;
  const criterion3 = weakImproved >= 3;
  const go = criterion1 && criterion2;

  log(`${r.modelId} (${r.modelName}${r.queryPrefix ? ' +prefix' : ''}):`);
  log(
    `  [${criterion1 ? '✓' : '✗'}] Total improvement: ${totalImprovement >= 0 ? '+' : ''}${totalImprovement} (need >= +2)`
  );
  log(
    `  [${criterion2 ? '✓' : '✗'}] Scenario degradation: ${degradedScenarios.length === 0 ? 'none' : degradedScenarios.join(', ')}`
  );
  log(
    `  [${criterion3 ? '✓' : '✗'}] Weak claims improved: ${weakImproved}/${weakClaims.length} (want >= 3)`
  );
  log(`  → ${go ? '✅ GO' : '❌ NO-GO'}`);
  log('');
}

function printModelRecommendation(results: ModelResult[]): void {
  if (results.length === 0) {
    return;
  }

  const viable = results.filter(isViable);

  if (viable.length > 0) {
    log('RECOMMENDATION:');
    const best = viable.reduce((a, b) => {
      const aImpr =
        a.claims.reduce((s, c) => s + c.hybridScore, 0) -
        a.claims.reduce((s, c) => s + c.currentScore, 0);
      const bImpr =
        b.claims.reduce((s, c) => s + c.hybridScore, 0) -
        b.claims.reduce((s, c) => s + c.currentScore, 0);
      return bImpr > aImpr ? b : a;
    });
    log(
      `  Best model: ${best.modelId} (${best.modelName}${best.queryPrefix ? ' +prefix' : ''})`
    );
  } else {
    log('RECOMMENDATION: NO-GO — no model meets all criteria.');
  }
}

// ────────────────────────────────────────────
// Notable changes detail
// ────────────────────────────────────────────

function printNotableChanges(results: ModelResult[]): void {
  log('');
  log('══════════════════════════════════════════════════════════════');
  log('NOTABLE CHANGES (claims where hybrid Δ >= 2 or <= -2)');
  log('══════════════════════════════════════════════════════════════');

  for (const r of results) {
    const notable = r.claims.filter(
      (c) => Math.abs(c.hybridScore - c.currentScore) >= 2
    );
    if (notable.length === 0) {
      continue;
    }

    log('');
    log(`${r.modelId} (${r.modelName}${r.queryPrefix ? ' +prefix' : ''}):`);
    for (const c of notable) {
      const delta = c.hybridScore - c.currentScore;
      const icon = delta > 0 ? '↑' : '↓';
      log(
        `  ${icon} ${c.id} (${c.scenario}): ${fmt(c.currentGrade, c.currentScore)} → ${fmt(c.hybridGrade, c.hybridScore)} (Δ${delta >= 0 ? '+' : ''}${delta})`
      );
      log(`    Current top-10: ${c.currentTop10.join(', ')}`);
      log(`    Hybrid  top-10: ${c.hybridTop10.join(', ')}`);
    }
  }
}

// ────────────────────────────────────────────
// Main
// ────────────────────────────────────────────

async function main(): Promise<void> {
  log('Embedding Feasibility Spike for suggestForClaim');
  log('================================================');
  log('');

  log('Loading knowledge graph...');
  const graphData = await loadGraphData({ local: true, dataDir: DATA_DIR });
  const graph = new KnowledgeGraph(graphData);

  log('Building corpus...');
  const corpus = buildCorpus(graph);
  const techniqueCount = graph.getAllTechniques().length;
  const claimCount = corpus.length - techniqueCount;
  log(
    `  Corpus: ${corpus.length} entries (${techniqueCount} descriptions + ${claimCount} claims)`
  );

  // Pre-compute current pipeline results (same for all models)
  log('Running current pipeline baseline...');
  const currentResults = new Map<string, string[]>();
  for (const rubric of RUBRICS) {
    // biome-ignore lint/nursery/noAwaitInLoop: sequential evaluation intentional
    const results = await graph.suggestForClaim(rubric.text);
    currentResults.set(
      rubric.id,
      results.results.map((t) => t.slug)
    );
  }

  const allModelResults: ModelResult[] = [];
  const corpusTexts = corpus.map((e) => e.text);

  for (const modelConfig of MODELS) {
    log('');
    log('═══════════════════════════════════════');
    log(`Model: ${modelConfig.id} (${modelConfig.name})`);
    if (modelConfig.queryPrefix) {
      log(`  Query prefix: "${modelConfig.queryPrefix}"`);
    }
    log('═══════════════════════════════════════');

    const memBefore = process.memoryUsage().heapUsed;

    // Load model
    log('  Loading model...');
    const loadStart = performance.now();
    let extractor: Extractor;
    try {
      // biome-ignore lint/nursery/noAwaitInLoop: models must load sequentially (memory)
      extractor = await pipeline('feature-extraction', modelConfig.name);
    } catch (err) {
      log(`  ❌ Failed to load model: ${err}`);
      continue;
    }
    const loadTimeMs = performance.now() - loadStart;
    log(`  Model loaded in ${(loadTimeMs / 1000).toFixed(1)}s`);

    // Embed corpus
    log(`  Embedding ${corpus.length} corpus entries...`);
    const embedStart = performance.now();
    const corpusVecs = await batchEmbed(extractor, corpusTexts);
    const corpusEmbedTimeMs = performance.now() - embedStart;
    log(`  Corpus embedded in ${(corpusEmbedTimeMs / 1000).toFixed(1)}s`);

    const memAfter = process.memoryUsage().heapUsed;
    const peakMemoryMB = (memAfter - memBefore) / 1024 / 1024;

    // Evaluate all claims
    const claimResults: ClaimResult[] = [];
    const queryTimes: number[] = [];

    for (const rubric of RUBRICS) {
      const queryStart = performance.now();

      // Embed the claim (with optional prefix)
      const queryText = modelConfig.queryPrefix
        ? `${modelConfig.queryPrefix}${rubric.text}`
        : rubric.text;
      // biome-ignore lint/nursery/noAwaitInLoop: sequential query embedding is intentional
      const queryOutput = await extractor([queryText], {
        pooling: 'mean',
        normalize: true,
      });
      const queryVec = (queryOutput.data as Float32Array).slice(
        0,
        queryOutput.dims[1] as number
      );

      // Rank by embedding similarity
      const embedSlugs = rankBySimilarity(queryVec, corpusVecs, corpus);
      queryTimes.push(performance.now() - queryStart);

      // Get current pipeline results
      const currentSlugs = currentResults.get(rubric.id) ?? [];

      // Compute hybrid RRF
      const hybridSlugs = computeRRF([currentSlugs, embedSlugs]);

      // Grade all three
      const current = gradeTop10(currentSlugs, rubric);
      const embed = gradeTop10(embedSlugs, rubric);
      const hybrid = gradeTop10(hybridSlugs, rubric);

      claimResults.push({
        id: rubric.id,
        scenario: rubric.scenario,
        currentScore: current.score,
        currentGrade: current.grade,
        currentTop10: currentSlugs.slice(0, 10),
        embedScore: embed.score,
        embedGrade: embed.grade,
        embedTop10: embedSlugs.slice(0, 10),
        hybridScore: hybrid.score,
        hybridGrade: hybrid.grade,
        hybridTop10: hybridSlugs.slice(0, 10),
      });
    }

    const avgQueryTimeMs =
      queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;

    const modelResult: ModelResult = {
      modelId: modelConfig.id,
      modelName: modelConfig.name,
      queryPrefix: modelConfig.queryPrefix,
      loadTimeMs,
      corpusEmbedTimeMs,
      avgQueryTimeMs,
      peakMemoryMB,
      claims: claimResults,
    };
    allModelResults.push(modelResult);

    // Print per-scenario results for this model
    printModelResults(modelResult);

    // Dispose of model to free memory
    try {
      await extractor.dispose?.();
    } catch {
      // ignore — not all pipelines support dispose
    }
  }

  // Print overall summary
  printSummary(allModelResults);
  printNotableChanges(allModelResults);
  printGoNoGo(allModelResults);

  // Save JSON report
  const report = {
    timestamp: new Date().toISOString(),
    corpusSize: corpus.length,
    claimCount: RUBRICS.length,
    models: allModelResults,
  };
  await fs.mkdir(CLAIMS_DIR, { recursive: true });
  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
  log('');
  log(`Report written to: ${REPORT_PATH}`);
}

main().catch((err) => {
  // biome-ignore lint/suspicious/noConsole: CLI script error output
  console.error('Spike failed:', err);
  process.exit(1);
});
