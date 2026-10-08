#!/usr/bin/env node
/**
 * Apply a tag rename map to the dataset and the vocabulary.
 *
 * The map is a JSON object { "<from>": "<to>" | null }. For every technique
 * in public/data/techniques.json each tag equal to <from> becomes <to>
 * (or is removed when <to> is null); duplicates within a record collapse,
 * order is preserved. In lib/data/tag-definitions.ts the entry for <from>
 * is renamed to <to> when <to> has no entry yet, and removed when it has
 * one already or when <to> is null.
 *
 * The script also lists the fragments in the MCP server's CONCEPT_TAGS
 * (mcp-server/src/graph/index.ts) that matched a renamed tag and no longer
 * match its replacement, so they can be mirrored by hand.
 *
 * Usage:
 *   node scripts/dq/rename-tags.js --map <path.json> [--dry-run]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const TECHNIQUES = path.join(ROOT, 'public', 'data', 'techniques.json');
const DEFINITIONS = path.join(ROOT, 'lib', 'data', 'tag-definitions.ts');
const CONCEPTS = path.join(ROOT, 'mcp-server', 'src', 'graph', 'index.ts');

// One entry of the definitions object: an indented single-quoted key, a
// colon, optional line break, a quoted string value, a trailing comma.
const DEFINITION_ENTRY =
  /^([ \t]+)'([^']+)':[ \t]*\n?[ \t]*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"),[ \t]*\n/gm;
const CONCEPT_BLOCK = /CONCEPT_TAGS[^=]*=\s*\{([\s\S]*?)\n\};/;
const CONCEPT_FRAGMENT = /'([^']+)'/g;

function log(message) {
  // biome-ignore lint/suspicious/noConsole: CLI tool output
  console.log(message);
}

function parseArgs(argv) {
  const opts = { map: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--map') {
      opts.map = argv[i + 1];
      i++;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!opts.map) {
    throw new Error('Usage: rename-tags.js --map <path.json> [--dry-run]');
  }
  return opts;
}

function renameTechniqueTags(technique, map) {
  const next = [];
  const seen = new Set();
  const touched = [];
  for (const tag of technique.tags || []) {
    const target = Object.hasOwn(map, tag) ? map[tag] : tag;
    if (target !== tag) {
      touched.push(tag);
    }
    if (target !== null && !seen.has(target)) {
      seen.add(target);
      next.push(target);
    }
  }
  return { tags: next, touched };
}

function renameDataset(techniques, map) {
  const counts = new Map(Object.keys(map).map((from) => [from, 0]));
  let changedRecords = 0;
  for (const technique of techniques) {
    const { tags, touched } = renameTechniqueTags(technique, map);
    if (touched.length > 0) {
      changedRecords++;
      technique.tags = tags;
      for (const tag of touched) {
        counts.set(tag, counts.get(tag) + 1);
      }
    }
  }
  return { counts, changedRecords };
}

function renameDefinitions(source, map) {
  const existing = new Set(
    [...source.matchAll(DEFINITION_ENTRY)].map((m) => m[2])
  );
  const renamed = [];
  const removed = [];
  const output = source.replace(
    DEFINITION_ENTRY,
    (whole, indent, key, value) => {
      if (!Object.hasOwn(map, key)) {
        return whole;
      }
      const target = map[key];
      if (target === null || existing.has(target)) {
        removed.push(key);
        return '';
      }
      renamed.push(`${key} -> ${target}`);
      existing.add(target);
      return `${indent}'${target}':\n${indent}  ${value},\n`;
    }
  );
  return { output, renamed, removed };
}

function conceptFragmentsAffected(source, map) {
  const block = source.match(CONCEPT_BLOCK);
  if (!block) {
    return [];
  }
  const fragments = new Set(
    [...block[1].matchAll(CONCEPT_FRAGMENT)].map((m) => m[1])
  );
  const affected = [];
  for (const [from, to] of Object.entries(map)) {
    for (const fragment of fragments) {
      const matchedBefore = from.includes(fragment);
      const matchesAfter = to?.includes(fragment) ?? false;
      if (matchedBefore && !matchesAfter) {
        affected.push(`'${fragment}' matched ${from}; ${to ?? 'tag dropped'}`);
      }
    }
  }
  return affected;
}

function printReport({ counts, changedRecords, renamed, removed, affected }) {
  log('Dataset:');
  for (const [from, count] of counts) {
    log(`  ${String(count).padStart(4)}  ${from}`);
  }
  log(`  ${changedRecords} record(s) changed`);
  log(`Definitions: ${renamed.length} renamed, ${removed.length} removed`);
  for (const line of renamed) {
    log(`  ~ ${line}`);
  }
  for (const key of removed) {
    log(`  - ${key}`);
  }
  log(
    `CONCEPT_TAGS fragments to mirror in mcp-server/src/graph/index.ts: ${affected.length}`
  );
  for (const line of affected) {
    log(`  ! ${line}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const map = JSON.parse(await fs.readFile(path.resolve(opts.map), 'utf-8'));
  for (const [from, to] of Object.entries(map)) {
    if (to !== null && typeof to !== 'string') {
      throw new Error(`Map value for ${from} must be a string or null`);
    }
  }

  const raw = await fs.readFile(TECHNIQUES, 'utf-8');
  const techniques = JSON.parse(raw);
  const { counts, changedRecords } = renameDataset(techniques, map);

  const definitionsSource = await fs.readFile(DEFINITIONS, 'utf-8');
  const { output, renamed, removed } = renameDefinitions(
    definitionsSource,
    map
  );

  const conceptsSource = await fs.readFile(CONCEPTS, 'utf-8');
  const affected = conceptFragmentsAffected(conceptsSource, map);

  printReport({ counts, changedRecords, renamed, removed, affected });

  const unused = [...counts].filter(([, n]) => n === 0).map(([from]) => from);
  if (unused.length > 0) {
    log(`Map entries that matched no technique: ${unused.join(', ')}`);
  }

  if (opts.dryRun) {
    log('Dry run: nothing written.');
    return;
  }
  const trailing = raw.endsWith('\n') ? '\n' : '';
  await fs.writeFile(
    TECHNIQUES,
    `${JSON.stringify(techniques, null, 2)}${trailing}`
  );
  await fs.writeFile(DEFINITIONS, output);
  log('Written: public/data/techniques.json, lib/data/tag-definitions.ts');
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: CLI tool output
  console.error(error.message);
  process.exit(1);
});
