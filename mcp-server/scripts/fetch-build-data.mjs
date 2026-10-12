// Resolve DATA_REF once, then download only graph.jsonld from that exact commit.
// A full 40-character commit SHA is used as given, without asking the GitHub API.
import fs from 'node:fs/promises';
import path from 'node:path';

const outputDir = process.env.BUILD_DATA_DIR ?? '/data';
const ref = process.env.DATA_REF;
if (!ref) {
  throw new Error('DATA_REF is required');
}
const repo = 'alan-turing-institute/tea-techniques';
const FULL_SHA = /^[0-9a-f]{40}$/;

async function resolveCommit(name) {
  if (FULL_SHA.test(name)) {
    return name;
  }
  const response = await fetch(
    `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(name)}`,
    {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!response.ok) {
    throw new Error(`Resolve DATA_REF: HTTP ${response.status}`);
  }
  const { sha: resolved } = await response.json();
  if (!FULL_SHA.test(resolved)) {
    throw new Error('Invalid data commit');
  }
  return resolved;
}

const sha = await resolveCommit(ref);
const graph = await fetch(
  `https://raw.githubusercontent.com/${repo}/${sha}/public/data/ld/graph.jsonld`,
  { signal: AbortSignal.timeout(30_000) }
);
if (!graph.ok) {
  throw new Error(`Download graph: HTTP ${graph.status}`);
}
await fs.mkdir(path.join(outputDir, 'ld'), { recursive: true });
await fs.writeFile(path.join(outputDir, 'ld/graph.jsonld'), await graph.text());
await fs.writeFile(path.join(outputDir, 'data-version'), `${sha}\n`);
// biome-ignore lint/suspicious/noConsole: CLI progress output
console.log(`Pinned data: ${sha}`);
