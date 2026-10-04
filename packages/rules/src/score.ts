/** M01-FR-04 / FR-05 · Health score (Q-01 default). */
import type { ContentBundle } from '@identity/content';
import { detectMismatches } from './mismatch';
import type { HealthCheckInput, MismatchReport } from './types';

export const DEDUCTION_PER_ISSUE = 14;
export const GOOD_THRESHOLD = 70;

export type ScoreBand = 'all_valid' | 'good' | 'needs_attention';

export function healthScore(issueCount: number): number {
  return Math.max(0, 100 - DEDUCTION_PER_ISSUE * issueCount);
}

export function scoreBand(score: number): ScoreBand {
  if (score >= 100) return 'all_valid';
  if (score >= GOOD_THRESHOLD) return 'good';
  return 'needs_attention';
}

export interface HealthReport extends MismatchReport {
  score: number;
  band: ScoreBand;
  issueCount: number;
}

export function evaluateHealthCheck(input: HealthCheckInput, bundle: ContentBundle): HealthReport {
  const report = detectMismatches(input, bundle);
  const score = healthScore(report.issues.length);
  return { ...report, score, band: scoreBand(score), issueCount: report.issues.length };
}
