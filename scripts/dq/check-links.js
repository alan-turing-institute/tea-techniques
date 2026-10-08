#!/usr/bin/env node
/**
 * Check every resource link the techniques cite.
 *
 * Reads public/data/techniques.json and public/data/zotero-resources.json,
 * collects the URL (and DOI, if any) of every cited Zotero item, and requests
 * each unique URL once. A HEAD request is tried first; on 403, 405 or a
 * network error it falls back to GET. Redirects are followed and reported when
 * the final URL differs from the one stored.
 *
 * Findings, per cited item:
 *   dead        404, 410, other 4xx/5xx, or no response after the timeout
 *   blocked     403: the site refuses scripted requests; check by hand
 *   redirected  resolved, but landed on a different URL
 *   no-url      the Zotero item has no URL at all
 *   doi-missing the item has a DOI but its URL is not the DOI link
 *   ok          resolved at the stored URL
 *
 * Usage:
 *   node scripts/dq/check-links.js [--output <path>] [--slug <slug>]...
 *                                  [--concurrency 8] [--timeout 15000]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DATA = path.join(ROOT, 'public', 'data');
const TRAILING_SLASH = /\/$/;
const DOI_LINK = /doi\.org\//i;

const USER_AGENT =
  'tea-techniques-link-check/1.0 (+https://github.com/alan-turing-institute/tea-techniques)';

const log = (message) => {
  // biome-ignore lint/suspicious/noConsole: CLI tool output
  console.log(message);
};

function parseArgs(argv) {
  const args = { output: null, slugs: [], concurrency: 8, timeout: 15_000 };
  const takesValue = {
    '--output': 'output',
    '--slug': 'slugs',
    '--concurrency': 'concurrency',
    '--timeout': 'timeout',
  };
  let pending = null;
  for (const token of argv) {
    if (pending) {
      if (pending === 'slugs') {
        args.slugs.push(token);
      } else if (pending === 'output') {
        args.output = path.resolve(token);
      } else {
        args[pending] = Number(token);
      }
      pending = null;
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

async function request(url, method, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT, accept: '*/*' },
    });
    return { status: res.status, finalUrl: res.url, error: null };
  } catch (err) {
    return {
      status: 0,
      finalUrl: null,
      error: err.name === 'AbortError' ? 'timeout' : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function probe(url, timeout) {
  const head = await request(url, 'HEAD', timeout);
  if (head.status >= 200 && head.status < 400) {
    return { ...head, method: 'HEAD' };
  }
  const get = await request(url, 'GET', timeout);
  return { ...get, method: 'GET' };
}

function normalise(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString().replace(TRAILING_SLASH, '');
  } catch {
    return url;
  }
}

function classify(item, result) {
  if (!item.url) {
    return 'no-url';
  }
  if (result.status === 403) {
    return 'blocked';
  }
  if (result.status === 0 || result.status >= 400) {
    return 'dead';
  }
  if (result.finalUrl && normalise(result.finalUrl) !== normalise(item.url)) {
    return 'redirected';
  }
  if (item.DOI && !DOI_LINK.test(item.url)) {
    return 'doi-missing';
  }
  return 'ok';
}

function mapWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const run = () => {
    if (next >= items.length) {
      return Promise.resolve();
    }
    const i = next++;
    return Promise.resolve(fn(items[i], i)).then((r) => {
      results[i] = r;
      return run();
    });
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, run);
  return Promise.all(workers).then(() => results);
}

function collectCited(techniques, zotero, onlySlugs) {
  const cited = new Map();
  for (const t of techniques) {
    if (onlySlugs.length > 0 && !onlySlugs.includes(t.slug)) {
      continue;
    }
    for (const key of t.resources ?? []) {
      const item = zotero.get(key);
      if (!item) {
        continue;
      }
      const entry = cited.get(key) ?? {
        citationKey: key,
        url: item.url ?? '',
        DOI: item.DOI ?? '',
        techniques: [],
      };
      entry.techniques.push(t.slug);
      cited.set(key, entry);
    }
  }
  return [...cited.values()];
}

function detailFor(r) {
  if (r.finding === 'dead' || r.finding === 'blocked') {
    return `${r.status || r.error}`;
  }
  if (r.finding === 'redirected') {
    return `-> ${r.finalUrl}`;
  }
  if (r.finding === 'doi-missing') {
    return `DOI ${r.DOI}`;
  }
  return '';
}

function printFindings(report) {
  for (const finding of [
    'dead',
    'blocked',
    'no-url',
    'redirected',
    'doi-missing',
  ]) {
    for (const r of report.findings.filter((f) => f.finding === finding)) {
      log(
        `${finding.padEnd(12)} ${r.citationKey} ${detailFor(r)}  [${r.techniques.join(', ')}]`
      );
    }
  }
  const summary = Object.entries(report.counts)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
  log(`\nSummary: ${summary}`);
}

function probeAll(cited, args) {
  const byUrl = new Map();
  const noUrl = { status: null, finalUrl: null, error: 'no url', method: null };
  return mapWithLimit(cited, args.concurrency, async (item) => {
    let result = noUrl;
    if (item.url) {
      if (!byUrl.has(item.url)) {
        byUrl.set(item.url, probe(item.url, args.timeout));
      }
      result = await byUrl.get(item.url);
    }
    return { ...item, ...result, finding: classify(item, result) };
  });
}

function buildReport(results) {
  const counts = {};
  for (const r of results) {
    counts[r.finding] = (counts[r.finding] ?? 0) + 1;
  }
  return {
    generated_at: new Date().toISOString(),
    checked: results.length,
    counts,
    findings: results
      .filter((r) => r.finding !== 'ok')
      .sort((a, b) => a.finding.localeCompare(b.finding)),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [techniques, zoteroExport] = await Promise.all([
    readJson(path.join(DATA, 'techniques.json')),
    readJson(path.join(DATA, 'zotero-resources.json')),
  ]);
  const zotero = new Map(
    zoteroExport.items
      .filter((i) => i.citationKey)
      .map((i) => [i.citationKey, i])
  );
  const cited = collectCited(techniques, zotero, args.slugs);
  const distinct = new Set(cited.map((c) => c.url)).size;
  log(`Checking ${cited.length} cited items (${distinct} distinct URLs)...`);

  const report = buildReport(await probeAll(cited, args));
  if (args.output) {
    await fs.mkdir(path.dirname(args.output), { recursive: true });
    await fs.writeFile(args.output, `${JSON.stringify(report, null, 2)}\n`);
  }
  printFindings(report);
  if (args.output) {
    log(`Report written to ${args.output}`);
  }
  if (report.counts.dead) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  log(err.message);
  process.exit(1);
});
