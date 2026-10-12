/**
 * The texts the catalogue vectors are made from, and a hash that ties a vectors
 * file to the graph it was generated from.
 */

import { createHash } from 'node:crypto';
import type { TechniqueNode } from '../graph/types.js';

export interface CorpusEntry {
  text: string;
  slug: string;
}

/** One entry per technique description and per sample claim: `title: {name} | text: {content}`. */
export function buildCorpus(techniques: TechniqueNode[]): CorpusEntry[] {
  return techniques.flatMap((t) =>
    [t.description, ...t.sampleClaims.map((c) => c.text)].map((content) => ({
      text: `title: ${t.name} | text: ${content}`,
      slug: t.slug,
    }))
  );
}

/** SHA-256 over the ordered (slug, text) pairs. Any change to a text, a slug or the order changes it. */
export function corpusHash(corpus: CorpusEntry[]): string {
  return createHash('sha256')
    .update(JSON.stringify(corpus.map((e) => [e.slug, e.text])))
    .digest('hex');
}
