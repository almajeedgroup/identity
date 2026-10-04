import { seedBundle } from '@identity/content';
import { describe, expect, it } from 'vitest';
import { loadExample } from '../../../tools/spec/specs';
import { detectMismatches, issuesWithoutAction } from './mismatch';
import { buildNameDictionary, compareNames } from './names';
import { toInput, type ExampleInput } from './testing';
import type { Issue } from './types';

type ExpectedIssue = Pick<Issue, 'document' | 'field' | 'kind' | 'reason'>;
const strip = (issues: Issue[]): ExpectedIssue[] =>
  issues.map(({ document, field, kind, reason }) => ({ document, field, kind, reason }));
const sorted = (issues: ExpectedIssue[]) =>
  [...issues].sort((a, b) => `${a.document}:${a.field}`.localeCompare(`${b.document}:${b.field}`));

const dict = buildNameDictionary(seedBundle.nameVariants.groups);

describe('M02 Mismatch Detector', () => {
  it('@M02-AC-1.1 @M02-AC-5.1 M02-EX-irfan reproduces the DPR worked example', () => {
    const ex = loadExample<{
      input: ExampleInput;
      expect: {
        reference: string;
        fieldResults: Record<string, Record<string, string>>;
        issues: ExpectedIssue[];
        documentStatus: Record<string, string>;
        actions: string[];
      };
    }>('M02', 'M02-EX-irfan');
    const report = detectMismatches(toInput(ex.input), seedBundle);
    expect(report.reference).toBe(ex.expect.reference);
    for (const [field, row] of Object.entries(ex.expect.fieldResults)) {
      expect(report.fieldResults[field as keyof typeof report.fieldResults], field).toEqual(row);
    }
    expect(sorted(strip(report.issues))).toEqual(sorted(ex.expect.issues));
    expect(report.documentStatus).toEqual(ex.expect.documentStatus);
    expect(report.actions.map((a) => a.actionId)).toEqual(ex.expect.actions);
  });

  it('@M02-AC-1.2 M02-EX-reference picks Aadhaar, then PAN, then Voter ID', () => {
    const ex = loadExample<{ cases: { held: string[]; reference: string }[] }>('M02', 'M02-EX-reference');
    for (const c of ex.cases) {
      const input = toInput({ documents: Object.fromEntries(c.held.map((k) => [k, {}])) });
      expect(detectMismatches(input, seedBundle).reference).toBe(c.reference);
    }
  });

  it('@M02-AC-1.3 fields not printed or not entered are not applicable and raise no issue', () => {
    const report = detectMismatches(
      toInput({ documents: { aadhaar: { name: 'Fatima Shaikh', gender: 'female' }, pan: { name: 'Fatima Shaikh' } } }),
      seedBundle,
    );
    expect(report.fieldResults.gender).toEqual({ aadhaar: 'ok', pan: 'na' });
    expect(report.fieldResults.dob).toEqual({ aadhaar: 'na', pan: 'na' });
    expect(report.issues).toEqual([]);
  });

  const names = loadExample<{ cases: { a: string; b: string; expect: string; reason?: string }[] }>('M02', 'M02-EX-names');
  it.each(names.cases)('@M02-AC-2.1 M02-EX-names "$a" vs "$b" → $expect $reason', (c) => {
    const result = compareNames(c.a, c.b, dict);
    expect(result.result).toBe(c.expect);
    if (c.reason) expect('reason' in result ? result.reason : undefined).toBe(c.reason);
    // Classification must not depend on argument order.
    expect(compareNames(c.b, c.a, dict).result).toBe(c.expect);
  });

  const dobs = loadExample<{ cases: { name: string; documents: ExampleInput['documents']; issues: ExpectedIssue[] }[] }>(
    'M02',
    'M02-EX-dob',
  );
  it.each(dobs.cases)('@M02-AC-3.1 M02-EX-dob $name', (c) => {
    const report = detectMismatches(toInput({ documents: c.documents }), seedBundle);
    expect(sorted(strip(report.issues))).toEqual(sorted(c.issues));
  });

  it('@M02-AC-4.1 M02-EX-gender', () => {
    const ex = loadExample<{ documents: ExampleInput['documents']; issues: ExpectedIssue[] }>('M02', 'M02-EX-gender');
    expect(strip(detectMismatches(toInput({ documents: ex.documents }), seedBundle).issues)).toEqual(ex.issues);
  });

  const addresses = loadExample<{
    cases: { name: string; documents: ExampleInput['documents']; answers: ExampleInput['answers']; issues: ExpectedIssue[]; actions: string[] }[];
  }>('M02', 'M02-EX-address');
  it.each(addresses.cases)('@M02-AC-4.2 M02-EX-address $name', (c) => {
    const report = detectMismatches(toInput({ documents: c.documents, answers: c.answers }), seedBundle);
    expect(strip(report.issues)).toEqual(c.issues);
    expect(report.actions.map((a) => a.actionId)).toEqual(c.actions);
  });

  it('@M02-AC-4.3 M02-EX-moved flags every address and puts Aadhaar first', () => {
    const ex = loadExample<{ documents: ExampleInput['documents']; answers: ExampleInput['answers']; issues: ExpectedIssue[]; actions: string[] }>(
      'M02',
      'M02-EX-moved',
    );
    const report = detectMismatches(toInput({ documents: ex.documents, answers: ex.answers }), seedBundle);
    expect(sorted(strip(report.issues))).toEqual(sorted(ex.issues));
    expect(report.actions.map((a) => a.actionId)).toEqual(ex.actions);
  });

  it('@M02-AC-5.2 M02-EX-grouped gives one PAN action covering two fields', () => {
    const ex = loadExample<{
      documents: ExampleInput['documents'];
      issues: ExpectedIssue[];
      actions: string[];
      actionFields: Record<string, string[]>;
    }>('M02', 'M02-EX-grouped');
    const report = detectMismatches(toInput({ documents: ex.documents }), seedBundle);
    expect(sorted(strip(report.issues))).toEqual(sorted(ex.issues));
    expect(report.actions.map((a) => a.actionId)).toEqual(ex.actions);
    for (const a of report.actions) expect(a.fields).toEqual(ex.actionFields[a.actionId]);
  });

  it('M02-EX-unsure turns "Not sure" answers into tips, not issues', () => {
    const ex = loadExample<{ documents: ExampleInput['documents']; answers: ExampleInput['answers']; issues: ExpectedIssue[]; tips: string[] }>(
      'M02',
      'M02-EX-unsure',
    );
    const report = detectMismatches(toInput({ documents: ex.documents, answers: ex.answers }), seedBundle);
    expect(report.issues).toEqual(ex.issues);
    expect([...report.tips].sort()).toEqual([...ex.tips].sort());
  });

  it('@M02-AC-6.1 is deterministic and does not modify its input', () => {
    const input = toInput(loadExample<{ input: ExampleInput }>('M02', 'M02-EX-irfan').input);
    const before = structuredClone(input);
    const first = detectMismatches(input, seedBundle);
    const second = detectMismatches(input, seedBundle);
    expect(second).toEqual(first);
    expect(input).toEqual(before);
  });

  it('M02-FR-13 every issue the detector can raise has an action in the seed content', () => {
    const everything = toInput({
      documents: {
        aadhaar: { name: 'A B', dob: '1990', gender: 'male', locality: 'X' },
        pan: { name: 'C D', dob: '01-01-1991' },
        voter_id: { name: 'E F', dob: '02-02-1992', gender: 'female', locality: 'Y' },
      },
      answers: { mobileLinked: 'no', documentsUpdatedWithin10Years: 'no', livesAtDocumentAddress: 'no' },
    });
    const report = detectMismatches(everything, seedBundle);
    expect(report.issues.length).toBeGreaterThan(8);
    expect(issuesWithoutAction(report.issues, seedBundle)).toEqual([]);
  });
});
