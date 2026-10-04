import { seedBundle } from '@identity/content';
import { describe, expect, it } from 'vitest';
import { loadExample } from '../../../tools/spec/specs';
import { evaluateHealthCheck, healthScore, scoreBand } from './score';
import { toInput, type ExampleInput } from './testing';

const scores = loadExample<{
  cases: {
    name: string;
    documents: ExampleInput['documents'];
    answers: ExampleInput['answers'];
    expect: { score: number; band: string; issueCount?: number; documentStatus?: Record<string, string> };
  }[];
}>('M01', 'M01-EX-scores');

describe('M01 Health Check scoring', () => {
  it.each(scores.cases)('@M01-AC-2.1 M01-EX-scores $name', (c) => {
    const report = evaluateHealthCheck(toInput({ documents: c.documents, answers: c.answers }), seedBundle);
    expect(report.score).toBe(c.expect.score);
    expect(report.band).toBe(c.expect.band);
    if (c.expect.issueCount !== undefined) expect(report.issueCount).toBe(c.expect.issueCount);
    if (c.expect.documentStatus) expect(report.documentStatus).toEqual(c.expect.documentStatus);
  });

  it('M01-FR-04 / FR-05 score and band boundaries', () => {
    expect([0, 1, 2, 3, 7, 8].map(healthScore)).toEqual([100, 86, 72, 58, 2, 0]);
    expect([100, 99, 70, 69, 0].map(scoreBand)).toEqual(['all_valid', 'good', 'good', 'needs_attention', 'needs_attention']);
  });
});
