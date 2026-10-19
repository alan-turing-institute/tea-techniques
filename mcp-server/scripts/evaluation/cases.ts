import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

export const labelSchema = z.enum(['good', 'acceptable', 'bad']);
const slugs = z
  .array(z.string().min(1))
  .transform((items) => [...new Set(items)])
  .default([]);
const claimSchema = z
  .object({
    id: z.string().trim().min(1),
    text: z
      .string()
      .refine((text) => text.trim() !== '', 'Claim text must not be empty'),
    good: slugs,
    acceptable: slugs,
    bad: slugs,
    notes: z.record(z.string()).optional(),
    votes: z.record(z.array(labelSchema)).optional(),
  })
  .superRefine((claim, ctx) => {
    const listsBySlug = new Map<string, string[]>();
    for (const list of labelSchema.options) {
      for (const slug of claim[list]) {
        listsBySlug.set(slug, [...(listsBySlug.get(slug) ?? []), list]);
      }
    }
    const overlaps = [...listsBySlug]
      .filter(([, lists]) => lists.length > 1)
      .map(([slug, lists]) => `${slug} (${lists.join(', ')})`);
    if (overlaps.length) {
      ctx.addIssue({
        code: 'custom',
        message: `Claim ${claim.id}: a slug appears in more than one label list: ${overlaps.join('; ')}`,
      });
    }
  });
const caseSchema = z
  .object({
    schema: z.literal(1),
    id: z.string().min(1),
    title: z.string().min(1),
    system: z.string().min(1),
    goal: z.string().optional(),
    claims: z.array(claimSchema).min(1),
  })
  .superRefine((rubric, ctx) => {
    if (
      new Set(rubric.claims.map((claim) => claim.id)).size !==
      rubric.claims.length
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Claim ids must be unique within a case',
      });
    }
  });
export type CaseRubric = z.infer<typeof caseSchema>;
export type ClaimRubric = CaseRubric['claims'][number];

export function parseCase(value: unknown, filename: string): CaseRubric {
  try {
    const rubric = caseSchema.parse(value);
    if (rubric.id !== path.basename(filename, '.rubric.json')) {
      throw new Error('Case id must equal the filename stem');
    }
    return rubric;
  } catch (error) {
    throw new Error(
      `${filename}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function loadCases(
  directory: string,
  ids?: string[]
): Promise<CaseRubric[]> {
  const files = (await fs.readdir(directory))
    .filter((file) => file.endsWith('.rubric.json'))
    .sort();
  const cases = await Promise.all(
    files.map(async (file) => {
      const filename = path.join(directory, file);
      let value: unknown;
      try {
        value = JSON.parse(await fs.readFile(filename, 'utf8'));
      } catch (error) {
        throw new Error(
          `${filename}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      return parseCase(value, filename);
    })
  );
  for (const id of ids ?? []) {
    if (!cases.some((rubric) => rubric.id === id)) {
      throw new Error(`Unknown case: ${id} in ${directory}`);
    }
  }
  const selected = ids
    ? cases.filter((rubric) => ids.includes(rubric.id))
    : cases;
  if (!selected.length) {
    throw new Error(`No case files selected in ${directory}`);
  }
  return selected;
}

export function unknownSlugs(rubric: CaseRubric, known: Set<string>): string[] {
  const all = rubric.claims.flatMap((claim) => [
    ...claim.good,
    ...claim.acceptable,
    ...claim.bad,
    ...Object.keys(claim.notes ?? {}),
    ...Object.keys(claim.votes ?? {}),
  ]);
  return [...new Set(all)].filter((slug) => !known.has(slug)).sort();
}
