/**
 * Types for the embedding-based semantic search system.
 */

import { z } from 'zod';
import { decodeVector } from './vectors.js';

/** A vector as stored in a file: a plain array of numbers, or little-endian float32 as base64. */
export type StoredVector = number[] | string;

/**
 * A fixed sentence and its vector, embedded as a query. A client that embeds
 * the same text (with the query prefix) can compare its vector with this one
 * to confirm it is using the catalogue's model.
 */
export interface EmbeddingProbe {
  text: string;
  vector: number[];
}

/** JSON file format written by generate script, loaded by server. */
export interface EmbeddingsFile {
  modelId: string;
  dimensions: number;
  corpusSize: number;
  /** Where the weights came from, and which revision of that repository. */
  modelRepo?: string;
  modelRevision?: string;
  dtype?: string;
  queryPrefix?: string;
  documentFormat?: string;
  /** Commit of the graph the corpus was read from. */
  dataCommit?: string;
  /** SHA-256 of the corpus texts the vectors were made from (see `corpusHash`). */
  corpusSha256?: string;
  probes?: Array<{ text: string; vector: StoredVector }>;
  entries: Array<{ slug: string; vector: StoredVector }>;
}

/** Runtime format with Float32Arrays for efficient similarity computation. */
export interface EmbeddingsIndex {
  modelId: string;
  dimensions: number;
  slugs: string[];
  vectors: Float32Array[];
  queryPrefix?: string;
  documentFormat?: string;
  corpusSha256?: string;
  probes?: EmbeddingProbe[];
}

/** Reads a stored vector as float32 values, or returns null if it is not `dimensions` finite values. */
export function readStoredVector(
  stored: StoredVector,
  dimensions: number
): Float32Array | null {
  if (typeof stored !== 'string' && stored.length !== dimensions) {
    return null;
  }
  const vector =
    typeof stored === 'string'
      ? decodeVector(stored, dimensions)
      : Float32Array.from(stored);
  return vector?.every(Number.isFinite) ? vector : null;
}

// --- Zod schema for runtime validation at parse boundaries ---

const StoredVectorSchema = z.union([
  z.array(z.number().finite()),
  z.string().min(1),
]);

export const EmbeddingsFileSchema = z
  .object({
    modelId: z.string(),
    dimensions: z.number().int().positive(),
    corpusSize: z.number().int().nonnegative(),
    modelRepo: z.string().optional(),
    modelRevision: z.string().optional(),
    dtype: z.string().optional(),
    queryPrefix: z.string().optional(),
    documentFormat: z.string().optional(),
    dataCommit: z.string().optional(),
    corpusSha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
    probes: z
      .array(
        z.object({
          text: z.string().min(1),
          vector: StoredVectorSchema,
        })
      )
      .optional(),
    entries: z.array(
      z.object({
        slug: z.string(),
        vector: StoredVectorSchema,
      })
    ),
  })
  .superRefine((file, ctx) => {
    const usable = (stored: StoredVector): boolean => {
      const vector = readStoredVector(stored, file.dimensions);
      return vector?.some((v) => v !== 0) === true;
    };
    if (
      file.corpusSize !== file.entries.length ||
      !file.entries.every((e) => usable(e.vector)) ||
      !(file.probes ?? []).every((p) => usable(p.vector))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Embedding corpus size or vector dimensions invalid',
      });
    }
  });
