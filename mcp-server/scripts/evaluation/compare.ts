import fs from 'node:fs/promises';
import { z } from 'zod';
import { average } from './scoring.js';

const reportSchema = z.object({
  schema: z.literal(1),
  cases: z.array(
    z.object({
      id: z.string().min(1),
      claims: z.array(
        z.object({ id: z.string().min(1), totalScore: z.number().finite() })
      ),
    })
  ),
});
function indexReportBody(value: unknown) {
  const report = reportSchema.parse(value);
  const cases = new Set<string>();
  const claims = new Map<
    string,
    { caseId: string; claimId: string; score: number }
  >();
  for (const item of report.cases) {
    if (cases.has(item.id)) {
      throw new Error(`Duplicate case: ${item.id}`);
    }
    cases.add(item.id);
    for (const claim of item.claims) {
      const key = JSON.stringify([item.id, claim.id]);
      if (claims.has(key)) {
        throw new Error(`Duplicate claim: ${item.id}/${claim.id}`);
      }
      claims.set(key, {
        caseId: item.id,
        claimId: claim.id,
        score: claim.totalScore,
      });
    }
  }
  return claims;
}
function indexReport(value: unknown, source: string) {
  try {
    return indexReportBody(value);
  } catch (error) {
    throw new Error(
      `${source}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
const difference = (scoreA: number, scoreB: number) => ({
  scoreA,
  scoreB,
  difference: scoreB - scoreA,
});

/**
 * Compare shared claims only, so missing claims cannot skew the aggregates.
 * `sources` names the two reports in error messages.
 */
export function compareReports(
  a: unknown,
  b: unknown,
  sources: [string, string] = ['report A', 'report B']
) {
  const left = indexReport(a, sources[0]);
  const right = indexReport(b, sources[1]);
  const claims = [...left.entries()].flatMap(([key, claim]) => {
    const other = right.get(key);
    return other
      ? [
          {
            caseId: claim.caseId,
            claimId: claim.claimId,
            ...difference(claim.score, other.score),
          },
        ]
      : [];
  });
  if (!claims.length) {
    throw new Error('Reports share no claims');
  }
  const cases = [...new Set(claims.map((claim) => claim.caseId))].map((id) => {
    const shared = claims.filter((claim) => claim.caseId === id);
    return {
      id,
      claimCount: shared.length,
      ...difference(
        average(shared.map((claim) => claim.scoreA)),
        average(shared.map((claim) => claim.scoreB))
      ),
    };
  });
  const onlyIn = (source: typeof left, other: typeof left) =>
    [...source.entries()]
      .filter(([key]) => !other.has(key))
      .map(([, claim]) => ({ caseId: claim.caseId, claimId: claim.claimId }));
  return {
    schema: 1,
    aggregation: 'shared-claims',
    claims,
    cases,
    overall: {
      claimCount: claims.length,
      caseCount: cases.length,
      ...difference(
        average(claims.map((claim) => claim.scoreA)),
        average(claims.map((claim) => claim.scoreB))
      ),
      averageCaseScores: difference(
        average(cases.map((item) => item.scoreA)),
        average(cases.map((item) => item.scoreB))
      ),
    },
    onlyInA: onlyIn(left, right),
    onlyInB: onlyIn(right, left),
  };
}

async function readReport(filename: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(filename, 'utf8'));
  } catch (error) {
    throw new Error(
      `${filename}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/** Read two report files and compare them; every error names its file. */
export async function compareReportFiles(fileA: string, fileB: string) {
  const [a, b] = await Promise.all([readReport(fileA), readReport(fileB)]);
  return compareReports(a, b, [fileA, fileB]);
}
