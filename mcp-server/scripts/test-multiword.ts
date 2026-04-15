/**
 * Quick test: multi-word NL query behavior in findTechniques.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGraphData } from '../src/data/loader.js';
import { KnowledgeGraph } from '../src/graph/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', '..', 'public', 'data');

async function main(): Promise<void> {
  const graph = new KnowledgeGraph(
    await loadGraphData({ local: true, dataDir: DATA_DIR })
  );

  const queries = [
    'sensitivity parameter perturbation',
    'bayesian uncertainty posterior',
    'robustness adversarial testing',
    'metamorphic testing invariant',
    'bootstrapping resampling',
    'model fairness bias',
    'neural network pruning',
    'uncertainty quantification ensemble',
    'feature importance ranking',
    'privacy differential noise',
  ];

  // biome-ignore lint/suspicious/noConsole: test script
  const log = console.log.bind(console);
  log('Multi-word query test');
  log('=====================');
  for (const q of queries) {
    const r = graph.findTechniques({ query: q });
    const names = r.slice(0, 3).map((t) => t.slug);
    log(
      `"${q}" -> ${r.length} results${names.length > 0 ? `: ${names.join(', ')}` : ''}`
    );
  }
}

main().catch((err) => {
  // biome-ignore lint/suspicious/noConsole: test script
  console.error(err);
  process.exit(1);
});
