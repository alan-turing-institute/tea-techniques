/**
 * Pure math functions for embedding-based search.
 *
 * All vectors are assumed to be L2-normalised, so dotProduct = cosine similarity.
 */

import type { EmbeddingsIndex } from './types.js';

/** Cosine similarity for L2-normalised vectors. */
function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Rank techniques by embedding similarity to a query vector.
 * Deduplicates by slug (keeps best score per slug), returns sorted slugs.
 */
export function rankBySimilarity(
  queryVec: Float32Array,
  index: EmbeddingsIndex,
  topK = 10
): string[] {
  if (index.vectors.length > 0 && queryVec.length !== index.dimensions) {
    throw new Error(
      `Query vector dimensions (${queryVec.length}) don't match index dimensions (${index.dimensions})`
    );
  }
  const bestPerSlug = new Map<string, number>();
  for (let i = 0; i < index.vectors.length; i++) {
    const sim = dotProduct(queryVec, index.vectors[i]);
    const slug = index.slugs[i];
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

/**
 * Reciprocal Rank Fusion: merges multiple ranked slug lists.
 * Each ranking contributes 1/(k + rank + 1) for each slug at that rank.
 */
export function computeRRF(rankings: string[][], k = 60, topK = 10): string[] {
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

/**
 * Normalized RRF scores, exposed as retrievalScore (not a probability).
 * When the weights of the given rankings sum to zero, every ranking counts equally.
 */
export function computeRRFScores(
  rankings: string[][],
  k = 60,
  weights: number[] = []
): Array<{ slug: string; score: number }> {
  const scores = new Map<string, number>();
  const given = rankings.map((_, r) => weights[r] ?? 1);
  const active =
    given.reduce((sum, w) => sum + w, 0) > 0 ? given : given.map(() => 1);
  let weightSum = 0;
  for (const [r, ranking] of rankings.entries()) {
    const weight = active[r];
    weightSum += weight;
    for (const [i, slug] of ranking.entries()) {
      scores.set(slug, (scores.get(slug) ?? 0) + weight / (k + i + 1));
    }
  }
  const maximum = weightSum / (k + 1);
  return Array.from(scores, ([slug, score]) => ({
    slug,
    score: score / maximum,
  })).sort((a, b) => b.score - a.score);
}
