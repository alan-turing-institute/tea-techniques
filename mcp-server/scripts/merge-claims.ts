/**
 * Merge claims from data/claims/*.json into public/data/techniques.json.
 *
 * For each technique, reads the corresponding claims file and adds a
 * `sample_claims` field (matching the snake_case convention of the source).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CLAIMS_DIR = path.join(PROJECT_ROOT, 'data', 'claims');
const TECHNIQUES_PATH = path.join(
  PROJECT_ROOT,
  'public',
  'data',
  'techniques.json'
);

interface Claim {
  text: string;
  domain: string;
  assuranceGoal: string;
}

interface ClaimFile {
  slug: string;
  name: string;
  claims: Claim[];
}

async function loadClaimsMap(): Promise<Map<string, Claim[]>> {
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

  const map = new Map<string, Claim[]>();
  for (const file of files) {
    map.set(file.slug, file.claims);
  }
  return map;
}

async function main(): Promise<void> {
  const claimsMap = await loadClaimsMap();
  const techniques = JSON.parse(
    await fs.readFile(TECHNIQUES_PATH, 'utf-8')
  ) as Record<string, unknown>[];

  let merged = 0;
  let skipped = 0;

  for (const technique of techniques) {
    const slug = technique.slug as string;
    const claims = claimsMap.get(slug);
    if (claims) {
      technique.sample_claims = claims;
      merged++;
    } else {
      skipped++;
    }
  }

  await fs.writeFile(
    TECHNIQUES_PATH,
    `${JSON.stringify(techniques, null, 2)}\n`
  );

  // biome-ignore lint/suspicious/noConsole: CLI script output
  console.error(
    `Merged claims into techniques.json: ${merged} merged, ${skipped} skipped (no claims file)`
  );
}

main().catch((err) => {
  // biome-ignore lint/suspicious/noConsole: CLI script error output
  console.error('Merge failed:', err);
  process.exit(1);
});
