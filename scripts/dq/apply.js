#!/usr/bin/env node
/**
 * Apply data-quality proposals to public/data/techniques.json.
 *
 * Specialists never edit techniques.json. They write one proposal file per
 * technique under scripts/dq/proposals/<slug>.json (gitignored), and this
 * script merges the proposals in, validates every changed record against the
 * schema, and writes the result. Run it with --dry-run first.
 *
 * Proposal shape (every part optional except slug):
 *
 *   {
 *     "slug": "permutation-importance",
 *     "run": "resources" | "prose" | "tags",
 *     "author": "who or which run produced it",
 *     "date": "YYYY-MM-DD",
 *     "fields": {
 *       "description": "...",            // full replacement values only
 *       "example_use_cases": [...],
 *       "limitations": [...],
 *       "tags": [...],
 *       "assurance_goals": [...],
 *       "sample_claims": [...],
 *       "acronym": "..."
 *     },
 *     "resources": {
 *       "keep": ["citekey", ...],         // optional check: every current key
 *                                         // must appear here or in drop
 *       "drop": [{ "citekey": "...", "reason": "..." }],
 *       "add":  [{ "citekey": "...", "slot": "documentation", "reason": "..." }],
 *       "update": [{ "citekey": "...", "slot": "tutorial", "url": "...",
 *                    "reason": "..." }],  // Zotero-side edits for the writer
 *       "empty": { "software_package": "what was searched and why nothing fits" }
 *     },
 *     "notes": "anything the writer should know"
 *   }
 *
 * The resources after the run are the current keys minus "drop" plus "add".
 * "keep" never removes anything: when it is given, a current key missing from
 * both lists is a problem and the proposal is skipped. Slot names use the
 * underscore form (documentation, software_package, technical_paper, tutorial,
 * application_paper). "update" changes nothing here; it is reported so the
 * writer retags or corrects the item in Zotero before the export refreshes.
 *
 * "add" citekeys must already resolve in public/data/zotero-resources.json:
 * the writer adds items to the Zotero group first, the auto-export refreshes
 * the file, then this script runs. A proposal whose adds do not resolve is
 * skipped and reported, never half-applied.
 *
 * Empty-slot records are appended to scripts/dq/empty-slots.json so the next
 * reviewer sees what was searched.
 *
 * Usage:
 *   node scripts/dq/apply.js [--dry-run] [--slug <slug>]... [--proposals <dir>]
 *                            [--report <path>]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { normaliseTags } from './normalise-tags.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DATA = path.join(ROOT, 'public', 'data');
const TECHNIQUES = path.join(DATA, 'techniques.json');
const ZOTERO = path.join(DATA, 'zotero-resources.json');
const SCHEMA = path.join(ROOT, 'schemas', 'technique.schema.json');
const EMPTY_SLOTS = path.join(__dirname, 'empty-slots.json');

const REPLACEABLE_FIELDS = new Set([
  'description',
  'example_use_cases',
  'limitations',
  'tags',
  'assurance_goals',
  'sample_claims',
  'acronym',
]);

const SLOT_ORDER = [
  'documentation',
  'software_package',
  'technical_paper',
  'tutorial',
  'application_paper',
];

const log = (message) => {
  // biome-ignore lint/suspicious/noConsole: CLI tool output
  console.log(message);
};

function parseArgs(argv) {
  const args = {
    dryRun: false,
    slugs: [],
    proposals: path.join(__dirname, 'proposals'),
    report: null,
  };
  const takesValue = {
    '--slug': 'slugs',
    '--proposals': 'proposals',
    '--report': 'report',
  };
  let pending = null;
  for (const token of argv) {
    if (pending) {
      if (pending === 'slugs') {
        args.slugs.push(token);
      } else {
        args[pending] = path.resolve(token);
      }
      pending = null;
    } else if (token === '--dry-run') {
      args.dryRun = true;
    } else if (takesValue[token]) {
      pending = takesValue[token];
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf-8'));
}

async function readJsonOr(file, fallback) {
  try {
    return await readJson(file);
  } catch {
    return fallback;
  }
}

async function loadProposals(dir, onlySlugs) {
  let names = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const files = names.filter((n) => n.endsWith('.json')).sort();
  const loaded = await Promise.all(
    files.map(async (name) => ({
      file: name,
      ...(await readJson(path.join(dir, name))),
    }))
  );
  for (const p of loaded) {
    if (!p.slug) {
      throw new Error(`${p.file}: proposal has no slug`);
    }
  }
  return loaded.filter(
    (p) => onlySlugs.length === 0 || onlySlugs.includes(p.slug)
  );
}

function slotOf(item) {
  const typeTag = item?.tags?.find((t) => t.tag.startsWith('type:'));
  return typeTag ? typeTag.tag.replace('type:', '').replace(/-/g, '_') : null;
}

function keepAndDropProblems(current, spec) {
  const dropKeys = new Set((spec.drop ?? []).map((d) => d.citekey));
  const keepKeys = spec.keep ?? [];
  const notCurrent = (key) => !current.includes(key);
  const unaccounted = (key) => !(keepKeys.includes(key) || dropKeys.has(key));
  return [
    ...keepKeys
      .filter(notCurrent)
      .map((key) => `keep lists "${key}" which is not a current resource`),
    ...(spec.keep ? current : [])
      .filter(unaccounted)
      .map((key) => `current resource "${key}" is in neither keep nor drop`),
    ...[...dropKeys]
      .filter(notCurrent)
      .map((key) => `drop lists "${key}" which is not a current resource`),
  ];
}

function addProblem(add, zotero) {
  const item = zotero.get(add.citekey);
  if (!item) {
    return `add "${add.citekey}" does not resolve in zotero-resources.json`;
  }
  if (add.slot && slotOf(item) !== add.slot) {
    return `add "${add.citekey}" is tagged type:${slotOf(item)} in Zotero, proposal says ${add.slot}`;
  }
  return null;
}

function checkResourceSpec(current, spec, zotero) {
  const unresolved = (u) =>
    !(current.includes(u.citekey) || zotero.has(u.citekey));
  return [
    ...keepAndDropProblems(current, spec),
    ...(spec.update ?? [])
      .filter(unresolved)
      .map((u) => `update names "${u.citekey}" which does not resolve`),
    ...(spec.add ?? []).map((add) => addProblem(add, zotero)).filter(Boolean),
  ];
}

function mergeResources(current, spec, zotero) {
  const dropKeys = new Set((spec.drop ?? []).map((d) => d.citekey));
  const addKeys = (spec.add ?? []).map((a) => a.citekey);
  const next = [
    ...new Set([...current.filter((k) => !dropKeys.has(k)), ...addKeys]),
  ];
  const rank = (k) => {
    const i = SLOT_ORDER.indexOf(slotOf(zotero.get(k)) ?? '');
    return i === -1 ? SLOT_ORDER.length : i;
  };
  return next.sort((a, b) => rank(a) - rank(b));
}

function applyFields(before, after, fields) {
  const problems = [];
  const changed = [];
  for (const [field, raw] of Object.entries(fields)) {
    const value = field === 'tags' ? normaliseTags(raw) : raw;
    if (!REPLACEABLE_FIELDS.has(field)) {
      problems.push(`field "${field}" is not replaceable by proposal`);
    } else if (JSON.stringify(before[field]) !== JSON.stringify(value)) {
      after[field] = value;
      changed.push(field);
    }
  }
  return { problems, changed };
}

function applyResourceSpec(before, after, spec, zotero) {
  const current = before.resources ?? [];
  const problems = checkResourceSpec(current, spec, zotero);
  const changed = [];
  if (problems.length === 0) {
    const next = mergeResources(current, spec, zotero);
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      after.resources = next;
      changed.push('resources');
    }
  }
  const emptySlots = Object.entries(spec.empty ?? {}).map(([slot, note]) => ({
    slot,
    note,
  }));
  const updates = (spec.update ?? []).map((u) => ({
    citekey: u.citekey,
    slot: u.slot ?? null,
    url: u.url ?? null,
    reason: u.reason ?? '',
  }));
  return { problems, changed, emptySlots, updates };
}

function schemaProblems(validate, record) {
  if (validate(record)) {
    return [];
  }
  return validate.errors.map(
    (err) => `schema: ${err.instancePath || '/'} ${err.message}`
  );
}

function applyProposal(before, proposal, zotero, validate) {
  const after = structuredClone(before);
  const fields = applyFields(before, after, proposal.fields ?? {});
  const resources = proposal.resources
    ? applyResourceSpec(before, after, proposal.resources, zotero)
    : { problems: [], changed: [], emptySlots: [], updates: [] };
  const problems = [...fields.problems, ...resources.problems];
  if (problems.length === 0) {
    problems.push(...schemaProblems(validate, after));
  }
  const emptySlots = resources.emptySlots.map((e) => ({
    slug: proposal.slug,
    ...e,
    date: proposal.date ?? null,
  }));
  return {
    after,
    changed: [...fields.changed, ...resources.changed],
    problems,
    emptySlots,
    updates: resources.updates,
  };
}

function makeValidator(schema) {
  const ajv = new Ajv({
    allErrors: true,
    strict: true,
    validateFormats: true,
    validateSchema: false,
  });
  addFormats(ajv);
  return ajv.compile(schema);
}

async function writeOutputs(args, techniques, report, emptySlots) {
  if (!args.dryRun && report.applied.length > 0) {
    await fs.writeFile(TECHNIQUES, `${JSON.stringify(techniques, null, 2)}\n`);
  }
  if (!args.dryRun && emptySlots.length > 0) {
    const ledger = await readJsonOr(EMPTY_SLOTS, []);
    await fs.writeFile(
      EMPTY_SLOTS,
      `${JSON.stringify([...ledger, ...emptySlots], null, 2)}\n`
    );
  }
  if (args.report) {
    await fs.mkdir(path.dirname(args.report), { recursive: true });
    await fs.writeFile(args.report, `${JSON.stringify(report, null, 2)}\n`);
  }
}

function printReport(args, report, emptySlotCount) {
  const mode = args.dryRun ? '[dry-run] ' : '';
  for (const a of report.applied) {
    const what = a.changed.join(', ') || 'no change';
    log(
      `${mode}${a.slug}: ${what} (resources ${a.resources.before} -> ${a.resources.after})`
    );
  }
  for (const s of report.skipped) {
    log(`${mode}SKIPPED ${s.slug}: ${s.problems.join('; ')}`);
  }
  for (const a of report.applied) {
    for (const u of a.updates ?? []) {
      const what = [u.slot && `type:${u.slot}`, u.url && `url ${u.url}`]
        .filter(Boolean)
        .join(', ');
      log(
        `${mode}ZOTERO EDIT ${a.slug}: ${u.citekey} -> ${what} (${u.reason})`
      );
    }
  }
  log(
    `${mode}${report.applied.length} applied, ${report.skipped.length} skipped, ${emptySlotCount} empty-slot records`
  );
  if (!args.dryRun && report.applied.length > 0) {
    log('Now run: pnpm generate-data && pnpm validate');
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [techniques, zoteroExport, schema, proposals] = await Promise.all([
    readJson(TECHNIQUES),
    readJson(ZOTERO),
    readJson(SCHEMA),
    loadProposals(args.proposals, args.slugs),
  ]);
  if (proposals.length === 0) {
    log(`No proposals found in ${args.proposals}`);
    return;
  }
  const zotero = new Map(
    zoteroExport.items
      .filter((i) => i.citationKey)
      .map((i) => [i.citationKey, i])
  );
  const validate = makeValidator(schema);
  const bySlug = new Map(techniques.map((t, i) => [t.slug, i]));
  const report = { applied: [], skipped: [], dryRun: args.dryRun };
  const emptySlots = [];

  for (const proposal of proposals) {
    const idx = bySlug.get(proposal.slug);
    if (idx === undefined) {
      report.skipped.push({
        file: proposal.file,
        slug: proposal.slug,
        problems: ['no such technique'],
      });
      continue;
    }
    const before = techniques[idx];
    const result = applyProposal(before, proposal, zotero, validate);
    if (result.problems.length > 0) {
      report.skipped.push({
        file: proposal.file,
        slug: proposal.slug,
        problems: result.problems,
      });
      continue;
    }
    if (!args.dryRun) {
      techniques[idx] = result.after;
    }
    emptySlots.push(...result.emptySlots);
    report.applied.push({
      file: proposal.file,
      slug: proposal.slug,
      run: proposal.run ?? null,
      changed: result.changed,
      updates: result.updates,
      resources: {
        before: before.resources?.length ?? 0,
        after: result.after.resources?.length ?? 0,
      },
    });
  }

  await writeOutputs(args, techniques, report, emptySlots);
  printReport(args, report, emptySlots.length);
  if (report.skipped.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  log(err.message);
  process.exit(1);
});
