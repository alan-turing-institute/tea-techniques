import type { CaseRubric, ClaimRubric } from './cases.js';

export function scoreToGrade(score: number): string {
  if (score >= 8) {
    return 'A';
  }
  if (score >= 6) {
    return 'A-';
  }
  if (score >= 4) {
    return 'B+';
  }
  if (score >= 2) {
    return 'B';
  }
  if (score >= 0) {
    return 'B-';
  }
  if (score >= -2) {
    return 'C+';
  }
  if (score >= -4) {
    return 'C';
  }
  return 'D';
}

export type Label = 'good' | 'acceptable' | 'bad' | 'unlisted';
export function labelTechnique(slug: string, rubric: ClaimRubric): Label {
  if (rubric.good.includes(slug)) {
    return 'good';
  }
  if (rubric.bad.includes(slug)) {
    return 'bad';
  }
  if (rubric.acceptable.includes(slug)) {
    return 'acceptable';
  }
  return 'unlisted';
}
export function evaluateClaim(
  rubric: ClaimRubric,
  returnedSlugs: string[],
  metadata: {
    rankingAvailable: boolean;
    semanticUsed: boolean;
    elapsedMs: number;
  }
) {
  const labelCounts: Record<Label, number> = {
    good: 0,
    acceptable: 0,
    bad: 0,
    unlisted: 0,
  };
  const scores = returnedSlugs.map((slug) => {
    const label = labelTechnique(slug, rubric);
    labelCounts[label] += 1;
    const weights: Record<Label, 1 | 0 | -1> = {
      good: 1,
      bad: -1,
      acceptable: 0,
      unlisted: 0,
    };
    const score = weights[label];
    return { slug, label, score };
  });
  const totalScore = scores.reduce((sum, item) => sum + item.score, 0);
  return {
    id: rubric.id,
    text: rubric.text,
    ...metadata,
    returnedSlugs,
    scores,
    labelCounts,
    totalScore,
    grade: scoreToGrade(totalScore),
  };
}
export type ClaimEvaluation = ReturnType<typeof evaluateClaim>;
export const average = (values: number[]): number =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
export function evaluateCase(
  rubric: CaseRubric,
  claims: ClaimEvaluation[],
  unknown: string[]
) {
  return {
    id: rubric.id,
    title: rubric.title,
    claims,
    averageScore: average(claims.map((claim) => claim.totalScore)),
    unknownSlugs: unknown,
  };
}
export type CaseEvaluation = ReturnType<typeof evaluateCase>;
export function summarize(cases: CaseEvaluation[]) {
  const claims = cases.flatMap((item) => item.claims);
  return {
    caseCount: cases.length,
    claimCount: claims.length,
    averageScore: average(claims.map((claim) => claim.totalScore)),
    averageCaseScore: average(cases.map((item) => item.averageScore)),
  };
}
export interface EvaluationReport {
  schema: 1;
  timestamp: string;
  config: {
    embeddingModel: string;
    querySource: string;
    openrouterModel?: string;
    rankingEnabled: boolean;
    dataDirectory: string;
    casesDirectory: string;
  };
  embeddingsLoaded: boolean;
  cases: CaseEvaluation[];
  overall: ReturnType<typeof summarize>;
}
