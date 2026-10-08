#!/usr/bin/env node
/**
 * Deterministic tag normalisation.
 *
 * - A lifecycle stage tag (lifecycle-stage/<phase>/<stage>) implies its phase
 *   tag (lifecycle-stage/<phase>); the phase is added when missing.
 *   `lifecycle-stage/other/...` has no phase.
 * - Duplicates collapse; order is otherwise preserved.
 *
 * apply.js runs this on every proposal's tags. Run the file directly to
 * normalise the whole dataset:
 *
 *   node scripts/dq/normalise-tags.js [--dry-run]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIFECYCLE = 'lifecycle-stage/';
const NO_PHASE = new Set(['other']);

export function normaliseTags(tags) {
  const out = [];
  const seen = new Set();
  const push = (tag) => {
    if (!seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  };
  for (const tag of tags) {
    if (tag.startsWith(LIFECYCLE)) {
      const parts = tag.slice(LIFECYCLE.length).split('/');
      if (parts.length >= 2 && !NO_PHASE.has(parts[0])) {
        push(`${LIFECYCLE}${parts[0]}`);
      }
    }
    push(tag);
  }
  return out;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..'
  );
  const file = path.join(root, 'public', 'data', 'techniques.json');
  const raw = await fs.readFile(file, 'utf-8');
  const techniques = JSON.parse(raw);
  let changed = 0;
  for (const technique of techniques) {
    const next = normaliseTags(technique.tags || []);
    if (next.join('|') !== (technique.tags || []).join('|')) {
      changed++;
      technique.tags = next;
    }
  }
  // biome-ignore lint/suspicious/noConsole: CLI tool output
  console.log(`${changed} record(s) ${dryRun ? 'would change' : 'changed'}`);
  if (!dryRun && changed > 0) {
    const trailing = raw.endsWith('\n') ? '\n' : '';
    await fs.writeFile(
      file,
      `${JSON.stringify(techniques, null, 2)}${trailing}`
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  main().catch((error) => {
    // biome-ignore lint/suspicious/noConsole: CLI tool output
    console.error(error.message);
    process.exit(1);
  });
}
