#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TAG_SCORE_WEIGHT = 0.5;
const EMBEDDING_SCORE_WEIGHT = 0.5;
const GOAL_TAG_WEIGHT = 2;
const OTHER_TAG_WEIGHT = 1;
const ZERO_TAG_WEIGHT = 0;
const RELATED_LIMIT = 3;
// General stays at weight 0 until related lists are re-checked after the 9 November data cut.
const zeroWeightTags = new Set([
  'data-type/any',
  'assurance-goal-category/general',
]);
const rootDir = fileURLToPath(new URL('../', import.meta.url));

function tagWeight(tag) {
  if (zeroWeightTags.has(tag)) {
    return ZERO_TAG_WEIGHT;
  }
  return tag.startsWith('assurance-goal-category/')
    ? GOAL_TAG_WEIGHT
    : OTHER_TAG_WEIGHT;
}

export function weightedJaccard(left, right) {
  const leftTags = new Set(left);
  const rightTags = new Set(right);
  let shared = 0;
  let total = 0;
  for (const tag of new Set([...leftTags, ...rightTags])) {
    const weight = tagWeight(tag);
    total += weight;
    if (leftTags.has(tag) && rightTags.has(tag)) {
      shared += weight;
    }
  }
  return total === 0 ? 0 : shared / total;
}

/** Decode little-endian float32 entries, then normalise their per-slug mean. */
export function meanVectors({ entries, dimensions }) {
  const sums = new Map();
  for (const { slug, vector } of entries) {
    const bytes = Buffer.from(vector, 'base64');
    if (bytes.length !== dimensions * 4) {
      throw new Error(`Invalid embedding dimensions for ${slug}`);
    }
    const sum = sums.get(slug) ?? new Float64Array(dimensions);
    for (let i = 0; i < dimensions; i++) {
      const value = bytes.readFloatLE(i * 4);
      if (!Number.isFinite(value)) {
        throw new Error(`Non-finite embedding for ${slug}`);
      }
      sum[i] += value;
    }
    sums.set(slug, sum);
  }
  // Normalising the sum is equivalent to normalising the arithmetic mean.
  for (const [slug, sum] of sums) {
    const norm = Math.sqrt(sum.reduce((total, value) => total + value ** 2, 0));
    if (norm === 0) {
      throw new Error(`Zero mean embedding for ${slug}`);
    }
    sums.set(
      slug,
      sum.map((value) => value / norm)
    );
  }
  return sums;
}

/** Cosine similarity of unit vectors produced by meanVectors. */
export function cosineSimilarity(left, right) {
  return left.reduce((total, value, i) => total + value * right[i], 0);
}

export function relatedScore(left, right, vectors) {
  const tags = weightedJaccard(left.tags ?? [], right.tags ?? []);
  const leftVector = vectors.get(left.slug);
  const rightVector = vectors.get(right.slug);
  if (!(leftVector && rightVector)) {
    return tags;
  }
  return (
    TAG_SCORE_WEIGHT * tags +
    EMBEDDING_SCORE_WEIGHT * cosineSimilarity(leftVector, rightVector)
  );
}

export function computeRelated(techniques, vectors) {
  return techniques.map((technique) => ({
    ...technique,
    related_techniques: techniques
      .filter((other) => other.slug !== technique.slug)
      .map((other) => ({
        slug: other.slug,
        score: relatedScore(technique, other, vectors),
      }))
      .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug, 'en'))
      .slice(0, RELATED_LIMIT)
      .map(({ slug }) => slug),
  }));
}

export function orphanCount(techniques) {
  const referenced = new Set(
    techniques.flatMap((t) => t.related_techniques ?? [])
  );
  return techniques.filter((t) => !referenced.has(t.slug)).length;
}

export async function generateRelated({
  techniquesPath = path.join(rootDir, 'public/data/techniques.json'),
  vectorsPath = path.join(rootDir, 'mcp-server/vectors/embeddings.qwen3.json'),
} = {}) {
  const source = await fs.readFile(techniquesPath, 'utf8');
  const techniques = JSON.parse(source);
  const vectors = meanVectors(
    JSON.parse(await fs.readFile(vectorsPath, 'utf8'))
  );
  const updated = computeRelated(techniques, vectors);
  const changed = updated.filter(
    (t, i) =>
      JSON.stringify(t.related_techniques) !==
      JSON.stringify(techniques[i].related_techniques)
  ).length;
  if (changed > 0) {
    // Preserve the catalogue's two-space indentation and final newline.
    await fs.writeFile(techniquesPath, `${JSON.stringify(updated, null, 2)}\n`);
  }
  const summary = {
    techniques: techniques.length,
    tagsOnly: techniques.filter((t) => !vectors.has(t.slug)).length,
    orphansBefore: orphanCount(techniques),
    orphans: orphanCount(updated),
    changed,
  };
  // biome-ignore lint/suspicious/noConsole: build script summary
  console.log(
    `Related techniques: ${summary.techniques} techniques; ${summary.tagsOnly} using tags only; orphans ${summary.orphansBefore} -> ${summary.orphans}; ${summary.changed} lists changed.`
  );
  return summary;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  generateRelated().catch((error) => {
    // biome-ignore lint/suspicious/noConsole: build script error output
    console.error('Failed to generate related techniques:', error);
    process.exitCode = 1;
  });
}
