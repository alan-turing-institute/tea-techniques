#!/usr/bin/env node
/**
 * Turn a signed goal taxonomy into tag proposals and vocabulary entries.
 *
 * Input: <goal>.assignment.json as the taxonomy briefs produce it:
 *
 *   {
 *     "goal": "Safety",
 *     "values": [{ "tag": "assurance-goal-category/safety/<value>",
 *                  "name": "...", "definition": "..." }],
 *     "renames": { "<old full tag>": "<new full tag>" | null },
 *     "assignments": [{ "slug": "...", "tags": ["<full tag>", ...],
 *                       "confidence": "high|medium|low", "note": "" }]
 *   }
 *
 * For every assignment the script writes scripts/dq/proposals/<slug>.json
 * with fields.tags set to the technique's current tags, minus every tag under
 * assurance-goal-category/<goal>/, plus the assigned ones (the bare goal tag
 * stays). An existing proposal for the slug is layered on, so several goals
 * can be converted before one apply.js run. It adds a definition for each
 * value not yet in lib/data/tag-definitions.ts, and with --prune removes the
 * definitions of goal sub-tags that no technique will carry afterwards.
 *
 * Usage:
 *   node scripts/dq/apply-taxonomy.js --assignment <path.json> [--prune]
 *                                     [--dry-run] [--author <name>]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const TECHNIQUES = path.join(ROOT, 'public', 'data', 'techniques.json');
const DEFINITIONS = path.join(ROOT, 'lib', 'data', 'tag-definitions.ts');
const PROPOSALS = path.join(__dirname, 'proposals');
const GOAL_PREFIX = 'assurance-goal-category/';
const DEFINITION_KEY = /^\s+'([^']+)':/gm;
const DEFINITION_ENTRY =
  /^([ \t]+)'([^']+)':[ \t]*\n?[ \t]*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"),[ \t]*\n/gm;
const CLOSING = /\n\};\s*$/;

function log(message) {
  // biome-ignore lint/suspicious/noConsole: CLI tool output
  console.log(message);
}

function parseArgs(argv) {
  const opts = {
    assignment: null,
    prune: false,
    dryRun: false,
    author: 'taxonomy',
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--prune') {
      opts.prune = true;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--assignment' || arg === '--author') {
      opts[arg.slice(2)] = argv[i + 1];
      i++;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!opts.assignment) {
    throw new Error(
      'Usage: apply-taxonomy.js --assignment <path.json> [--prune] [--dry-run]'
    );
  }
  return opts;
}

async function readJsonOr(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function assignmentProblems(item, technique, goal, values) {
  if (!technique) {
    return [`${item.slug}: no such technique`];
  }
  const problems = [];
  if (!(technique.assurance_goals || []).includes(goal)) {
    problems.push(`${item.slug}: does not list goal ${goal}`);
  }
  if (!Array.isArray(item.tags) || item.tags.length === 0) {
    problems.push(`${item.slug}: no tags assigned`);
  }
  for (const tag of item.tags || []) {
    if (!values.has(tag)) {
      problems.push(`${item.slug}: ${tag} is not a value of the taxonomy`);
    }
  }
  return problems;
}

function checkAssignment(taxonomy, techniques) {
  const goal = taxonomy.goal;
  const prefix = `${GOAL_PREFIX}${goal.toLowerCase()}/`;
  const values = new Set((taxonomy.values || []).map((v) => v.tag));
  const problems = [...values]
    .filter((value) => !value.startsWith(prefix))
    .map((value) => `value ${value} is not under ${prefix}`);
  const bySlug = new Map(techniques.map((t) => [t.slug, t]));
  const assigned = new Set();
  for (const item of taxonomy.assignments || []) {
    problems.push(
      ...assignmentProblems(item, bySlug.get(item.slug), goal, values)
    );
    assigned.add(item.slug);
  }
  const missing = techniques.filter(
    (t) => (t.assurance_goals || []).includes(goal) && !assigned.has(t.slug)
  );
  problems.push(
    ...missing.map((t) => `${t.slug}: lists ${goal} but has no assignment`)
  );
  return problems;
}

function replaceGoalTags(tags, goalKey, assigned) {
  const prefix = `${GOAL_PREFIX}${goalKey}/`;
  const kept = tags.filter((tag) => !tag.startsWith(prefix));
  const bare = `${GOAL_PREFIX}${goalKey}`;
  if (!kept.includes(bare)) {
    kept.push(bare);
  }
  const index = kept.indexOf(bare);
  return [...kept.slice(0, index + 1), ...assigned, ...kept.slice(index + 1)];
}

async function buildProposals(taxonomy, techniques, author) {
  const goalKey = taxonomy.goal.toLowerCase();
  const bySlug = new Map(techniques.map((t) => [t.slug, t]));
  const date = new Date().toISOString().slice(0, 10);
  const proposals = await Promise.all(
    taxonomy.assignments.map(async (item) => {
      const file = path.join(PROPOSALS, `${item.slug}.json`);
      const existing = await readJsonOr(file, null);
      const base = existing?.fields?.tags || bySlug.get(item.slug).tags || [];
      const tags = replaceGoalTags(base, goalKey, item.tags);
      const note = `${taxonomy.goal} sub-category (${item.confidence})${item.note ? `: ${item.note}` : ''}`;
      const proposal = existing || {
        slug: item.slug,
        run: 'tags',
        author,
        date,
      };
      proposal.fields = { ...(proposal.fields || {}), tags };
      proposal.notes = proposal.notes ? `${proposal.notes}\n${note}` : note;
      return { file, proposal, changed: tags.join('|') !== base.join('|') };
    })
  );
  return proposals;
}

// A TypeScript string literal: single quotes unless the text has one.
function quote(text) {
  return text.includes("'") ? JSON.stringify(text) : `'${text}'`;
}

function definitionsAfter(source, taxonomy, pruneSet) {
  const defined = new Set(
    [...source.matchAll(DEFINITION_KEY)].map((m) => m[1])
  );
  const values = taxonomy.values || [];
  const additions = values.filter((v) => !defined.has(v.tag));
  const byTag = new Map(values.map((v) => [v.tag, v.definition]));
  const updated = [];
  let output = source.replace(
    DEFINITION_ENTRY,
    (whole, indent, key, current) => {
      if (pruneSet.has(key)) {
        return '';
      }
      const wanted = byTag.get(key);
      if (wanted === undefined || quote(wanted) === current) {
        return whole;
      }
      updated.push(key);
      return `${indent}'${key}':\n${indent}  ${quote(wanted)},\n`;
    }
  );
  if (additions.length > 0) {
    const block = additions
      .map((v) => `  '${v.tag}':\n    ${quote(v.definition)},\n`)
      .join('');
    output = output.replace(CLOSING, `\n${block}};\n`);
  }
  return { output, additions, updated };
}

function tagsUnusedAfter(taxonomy, techniques, proposals) {
  const goalKey = taxonomy.goal.toLowerCase();
  const prefix = `${GOAL_PREFIX}${goalKey}/`;
  const after = new Map(
    proposals.map((p) => [p.proposal.slug, p.proposal.fields.tags])
  );
  const inUse = new Set();
  for (const technique of techniques) {
    for (const tag of after.get(technique.slug) || technique.tags || []) {
      if (tag.startsWith(prefix)) {
        inUse.add(tag);
      }
    }
  }
  return { prefix, inUse };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const taxonomy = JSON.parse(
    await fs.readFile(path.resolve(opts.assignment), 'utf-8')
  );
  const techniques = JSON.parse(await fs.readFile(TECHNIQUES, 'utf-8'));

  const problems = checkAssignment(taxonomy, techniques);
  if (problems.length > 0) {
    log(`Assignment file has ${problems.length} problem(s); nothing written:`);
    for (const problem of problems) {
      log(`  ✗ ${problem}`);
    }
    process.exit(1);
  }

  const proposals = await buildProposals(taxonomy, techniques, opts.author);
  const source = await fs.readFile(DEFINITIONS, 'utf-8');
  const { prefix, inUse } = tagsUnusedAfter(taxonomy, techniques, proposals);
  const definedUnderGoal = [...source.matchAll(DEFINITION_KEY)]
    .map((m) => m[1])
    .filter((key) => key.startsWith(prefix) && !inUse.has(key));
  const pruneSet = new Set(opts.prune ? definedUnderGoal : []);
  const { output, additions, updated } = definitionsAfter(
    source,
    taxonomy,
    pruneSet
  );

  const changed = proposals.filter((p) => p.changed).length;
  log(
    `${taxonomy.goal}: ${proposals.length} assignment(s), ${changed} with changed tags`
  );
  log(`Definitions to add: ${additions.length}`);
  for (const v of additions) {
    log(`  + ${v.tag}`);
  }
  log(`Definitions reworded: ${updated.length}`);
  for (const key of updated) {
    log(`  ~ ${key}`);
  }
  log(
    `Definitions under ${prefix} unused afterwards: ${definedUnderGoal.length}${opts.prune ? ' (pruned)' : ' (keep; pass --prune to remove)'}`
  );
  for (const key of definedUnderGoal) {
    log(`  - ${key}`);
  }
  if (opts.dryRun) {
    log('Dry run: nothing written.');
    return;
  }
  await fs.mkdir(PROPOSALS, { recursive: true });
  await Promise.all(
    proposals.map((p) =>
      fs.writeFile(p.file, `${JSON.stringify(p.proposal, null, 2)}\n`)
    )
  );
  await fs.writeFile(DEFINITIONS, output);
  log(
    `Written: ${proposals.length} proposal(s) to scripts/dq/proposals/, lib/data/tag-definitions.ts. Next: node scripts/dq/apply.js`
  );
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: CLI tool output
  console.error(error.message);
  process.exit(1);
});
