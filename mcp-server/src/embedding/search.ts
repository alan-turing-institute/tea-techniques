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

/** Longest query vector the service will look at. */
export const MAX_QUERY_VECTOR_LENGTH = 4096;

/** A question vector sent by the caller, with the id of the model that made it. */
export interface QueryEmbeddingInput {
  model: string;
  vector: readonly unknown[];
}

export type PreparedQueryEmbedding =
  | { ok: true; vector: Float32Array }
  | { ok: false; reason: string };

/**
 * Checks a caller-supplied query vector against the loaded index and returns it
 * L2-normalised. The model id must equal the index's, the length must equal its
 * dimensions (and not exceed MAX_QUERY_VECTOR_LENGTH), and every value must be a
 * finite number as a 32-bit float. A failed check returns a reason that never
 * contains the vector's values.
 */
export function prepareQueryEmbedding(
  input: QueryEmbeddingInput,
  index: Pick<EmbeddingsIndex, 'modelId' | 'dimensions'>
): PreparedQueryEmbedding {
  if (input.model !== index.modelId) {
    return { ok: false, reason: 'model id differs from the embeddings file' };
  }
  const values: unknown = input.vector;
  if (!Array.isArray(values)) {
    return { ok: false, reason: 'vector is not an array' };
  }
  if (values.length > MAX_QUERY_VECTOR_LENGTH) {
    return {
      ok: false,
      reason: `vector has ${values.length} values; the limit is ${MAX_QUERY_VECTOR_LENGTH}`,
    };
  }
  if (values.length !== index.dimensions) {
    return {
      ok: false,
      reason: `vector has ${values.length} values; the embeddings file has ${index.dimensions}`,
    };
  }
  const vector = new Float32Array(values.length);
  let sumOfSquares = 0;
  for (let i = 0; i < values.length; i++) {
    const value: unknown = values[i];
    if (typeof value !== 'number') {
      return {
        ok: false,
        reason: 'vector contains a value that is not a number',
      };
    }
    vector[i] = value;
    if (!Number.isFinite(vector[i])) {
      return {
        ok: false,
        reason: 'vector contains a value that is not finite',
      };
    }
    sumOfSquares += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumOfSquares);
  if (!(norm > 0 && Number.isFinite(norm))) {
    return { ok: false, reason: 'vector has no usable length' };
  }
  for (let i = 0; i < vector.length; i++) {
    vector[i] /= norm;
  }
  return { ok: true, vector };
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
