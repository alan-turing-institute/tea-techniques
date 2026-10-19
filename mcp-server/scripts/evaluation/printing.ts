import type { compareReports } from './compare.js';
import type { EvaluationReport } from './scoring.js';

export function formatReport(report: EvaluationReport): string {
  const lines = [
    'Claims Evaluation',
    'Legend: + good, ~ acceptable, . unlisted, - bad',
  ];
  const markers = { good: '+', acceptable: '~', unlisted: '.', bad: '-' };
  for (const item of report.cases) {
    lines.push(`\n${item.title} (${item.id})`);
    for (const slug of item.unknownSlugs) {
      lines.push(`WARNING: unknown rubric slug: ${slug}`);
    }
    for (const claim of item.claims) {
      lines.push(
        `${claim.id}: ${claim.grade} (score: ${claim.totalScore}, ${claim.elapsedMs} ms, ranked: ${claim.rankingAvailable}, semantic: ${claim.semanticUsed})`,
        `  ${claim.text}`
      );
      for (const score of claim.scores) {
        lines.push(`  ${markers[score.label]} ${score.slug}`);
      }
    }
    lines.push(`Case average: ${item.averageScore.toFixed(2)}`);
  }
  lines.push(
    `\nOverall: ${report.overall.caseCount} cases, ${report.overall.claimCount} claims; average score: ${report.overall.averageScore.toFixed(2)}; average of case averages: ${report.overall.averageCaseScore.toFixed(2)}`
  );
  return lines.join('\n');
}

export function formatComparison(
  report: ReturnType<typeof compareReports>
): string {
  const lines = [
    'Comparison (shared claims only; difference = B - A)',
    'Claim / case: A → B (difference)',
  ];
  const row = (value: { scoreA: number; scoreB: number; difference: number }) =>
    `${value.scoreA.toFixed(2)} → ${value.scoreB.toFixed(2)} (${value.difference.toFixed(2)})`;
  for (const claim of report.claims) {
    lines.push(`${claim.caseId}/${claim.claimId}: ${row(claim)}`);
  }
  for (const item of report.cases) {
    lines.push(`Case ${item.id}: ${row(item)}`);
  }
  lines.push(
    `Overall: ${row(report.overall)}`,
    `Average of case averages: ${row(report.overall.averageCaseScores)}`
  );
  for (const [name, claims] of [
    ['A', report.onlyInA],
    ['B', report.onlyInB],
  ] as const) {
    lines.push(
      `Only in ${name}: ${claims.map((claim) => `${claim.caseId}/${claim.claimId}`).join(', ') || 'none'}`
    );
  }
  return lines.join('\n');
}
