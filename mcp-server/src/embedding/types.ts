/**
 * Types for the embedding-based semantic search system.
 */

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
  modelRevision?: string;
  dtype?: string;
  queryPrefix?: string;
  documentFormat?: string;
  probes?: EmbeddingProbe[];
  entries: Array<{ slug: string; vector: number[] }>;
}

/** Runtime format with Float32Arrays for efficient similarity computation. */
export interface EmbeddingsIndex {
  modelId: string;
  dimensions: number;
  slugs: string[];
  vectors: Float32Array[];
  probes?: EmbeddingProbe[];
}

// --- Zod schema for runtime validation at parse boundaries ---

import { z } from 'zod';

export const EmbeddingsFileSchema = z
  .object({
    modelId: z.string(),
    dimensions: z.number().int().positive(),
    corpusSize: z.number().int().nonnegative(),
    modelRevision: z.string().optional(),
    dtype: z.string().optional(),
    queryPrefix: z.string().optional(),
    documentFormat: z.string().optional(),
    probes: z
      .array(
        z.object({
          text: z.string().min(1),
          vector: z.array(z.number().finite()),
        })
      )
      .optional(),
    entries: z.array(
      z.object({
        slug: z.string(),
        vector: z.array(z.number().finite()),
      })
    ),
  })
  .superRefine((file, ctx) => {
    if (
      file.corpusSize !== file.entries.length ||
      file.entries.some(
        (e) =>
          e.vector.length !== file.dimensions || !e.vector.some((v) => v !== 0)
      ) ||
      file.probes?.some(
        (p) =>
          p.vector.length !== file.dimensions || !p.vector.some((v) => v !== 0)
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Embedding corpus size or vector dimensions invalid',
      });
    }
  });
