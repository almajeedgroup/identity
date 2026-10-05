import { seedKnowledgeBase, type CorrectionRule, type KnowledgeBase } from '@identity/content';
import { describe, expect, it } from 'vitest';
import { loadExample } from '../../../tools/spec/specs';
import { analyse, suggestTarget } from './analyse';
import { createContext } from './context';
import { compareValues } from './normalize';
import { buildRoadmap, type CorrectionStep, type RoadmapStep } from './roadmap';
import type { AddressValue, DocumentInput, FieldValue, Override, Target } from './types';

const ctx = createContext(seedKnowledgeBase);

describe('M02 Part B — statuses (PRD §11, §12)', () => {
  const ex = loadExample<{ cases: { field: string; a: string; b: string; status: string; reason?: string }[] }>('M02', 'M02-EX-statuses');
  it.each(ex.cases)('@M02-AC-7.1 @M02-AC-9.1 M02-EX-statuses $field "$a" vs "$b" → $status', (c) => {
    const r = compareValues(c.field as never, c.a, c.b, ctx);
    expect(r.status).toBe(c.status);
    if (c.reason) expect(r.reason).toBe(c.reason);
    // Comparison is symmetric in status.
    expect(compareValues(c.field as never, c.b, c.a, ctx).status).toBe(c.status);
  });

  it('@M02-AC-7.2 names are never better than "potential" unless equal after safe normalisation', () => {
    const pairs = [
      ['Mohammed Irfan', 'Muhammad Irfan'],
      ['Fatima', 'Fatima Shaikh'],
      ['M Irfan', 'Mohammed Irfan'],
      ['Irfan Mohammed', 'Mohammed Irfan'],
    ];
    for (const [a, b] of pairs) {
      const s = compareValues('name', a!, b!, ctx).status;
      expect(['potential_discrepancy', 'major_discrepancy'], `${a} / ${b}`).toContain(s);
    }
  });

  const addr = loadExample<{ cases: { name: string; a: AddressValue; b: AddressValue; status: string; reason?: string }[] }>('M02', 'M02-EX-address-full');
  it.each(addr.cases)('@M02-AC-9.2 M02-EX-address-full $name → $status', (c) => {
    const r = compareValues('address', c.a, c.b, ctx);
    expect(r.status).toBe(c.status);
    if (c.reason) expect(r.reason).toBe(c.reason);
  });
});

describe('M02 Part B — field analysis and report (PRD §13, §30)', () => {
  it('@M02-AC-8.2 M02-EX-relatives compares relatives by relation and leaves "other" uncompared', () => {
    const ex = loadExample<{ documents: DocumentInput[]; expect: { father_name: Record<string, string>; notCompared: string[] } }>('M02', 'M02-EX-relatives');
    const a = analyse({ documents: ex.documents }, ctx);
    const father = a.fields.find((f) => f.field === 'father_name')!;
    expect(Object.fromEntries(father.results.map((r) => [r.document, r.status]))).toEqual(ex.expect.father_name);
    expect(a.notCompared).toEqual(ex.expect.notCompared);
  });

  const report = loadExample<{
    documents: DocumentInput[];
    expect: {
      fields: Record<string, { colour: string; variations: number; formattingOnly: number; documents: number; missing: number; target?: string; review: string[] }>;
      issueCount: number;
      documentsRequiringReview: string[];
    };
  }>('M02', 'M02-EX-report');

  it('@M02-AC-11.1 @M02-AC-8.1 @M02-AC-10.1 M02-EX-report — per-field colour, variations, formatting-only, documents, missing, review', () => {
    const a = analyse({ documents: report.documents }, ctx);
    for (const [field, want] of Object.entries(report.expect.fields)) {
      const f = a.fields.find((x) => x.field === field)!;
      expect(f, field).toBeDefined();
      expect(
        { colour: f.colour, variations: f.variations, formattingOnly: f.formattingOnly, documents: f.documents, missing: f.missing, review: f.review },
        field,
      ).toEqual({ colour: want.colour, variations: want.variations, formattingOnly: want.formattingOnly, documents: want.documents, missing: want.missing, review: want.review });
      if (want.target) {
        expect(f.target?.display).toBe(want.target);
        expect(f.target?.status).toBe('suggested'); // M02-AC-10.1: target not confirmed
      }
    }
    expect(a.documentsRequiringReview).toEqual(report.expect.documentsRequiringReview);
  });

  it('@M02-AC-11.2 only potential and major discrepancies count as issues', () => {
    const a = analyse({ documents: report.documents }, ctx);
    expect(a.issueCount).toBe(report.expect.issueCount);
    for (const i of a.issues) expect(['potential_discrepancy', 'major_discrepancy']).toContain(i.status);
    const informational = a.fields.flatMap((f) => f.results).filter((r) => ['formatting_variation', 'likely_equivalent', 'missing'].includes(r.status));
    expect(informational.length).toBeGreaterThan(0);
  });

  it('@M02-AC-10.2 M02-EX-overrides — overrides change the status and are marked', () => {
    const ex = loadExample<{ overrides: Override[]; expect: { name: Record<string, string>; overridden: string[]; issueCount: number } }>('M02', 'M02-EX-overrides');
    const a = analyse({ documents: report.documents, overrides: ex.overrides }, ctx);
    const name = a.fields.find((f) => f.field === 'name')!;
    for (const [doc, status] of Object.entries(ex.expect.name)) expect(name.results.find((r) => r.document === doc)!.status, doc).toBe(status);
    expect(name.results.filter((r) => r.overridden).map((r) => r.document).sort()).toEqual([...ex.expect.overridden].sort());
    expect(a.issueCount).toBe(ex.expect.issueCount);
  });

  it('@M02-AC-12.1 pure: same input, same output; input untouched', () => {
    const input = { documents: structuredClone(report.documents) };
    const before = structuredClone(input);
    expect(analyse(input, ctx)).toEqual(analyse(input, ctx));
    expect(input).toEqual(before);
  });
});

describe('M16 target suggestions', () => {
  const ex = loadExample<{
    cases: { name: string; field: string; values: { id: string; kind: DocumentInput['kind']; value: FieldValue }[]; profileAddress?: AddressValue; expect: { value: FieldValue; supportedBy: string[]; reason: string } }[];
  }>('M16', 'M16-EX-suggestions');
  it.each(ex.cases)('@M16-AC-2.1 M16-EX-suggestions $name', (c) => {
    const s = suggestTarget(c.field as never, c.values, ctx, c.profileAddress)!;
    expect(s.value).toEqual(c.expect.value);
    expect(s.supportedBy).toEqual(c.expect.supportedBy);
    expect(s.reason).toBe(c.expect.reason);
  });

  it('@M16-AC-2.2 when no two documents agree, nothing is confirmed and every value is listed with its documents', () => {
    const a = analyse(
      {
        documents: [
          { id: 'pan', kind: 'pan', fields: { name: 'Fatima Ansari' } },
          { id: 'birth', kind: 'birth_certificate', fields: { name: 'Fatima Shaikh' } },
        ],
      },
      ctx,
    );
    const name = a.fields.find((f) => f.field === 'name')!;
    expect(name.target?.status).toBe('suggested');
    expect(name.results.map((r) => [r.document, r.display])).toEqual([
      ['birth', 'Fatima Shaikh'],
      ['pan', 'Fatima Ansari'],
    ]);
  });

  it('@M16-AC-3.2 M16-EX-stability — a confirmed target is never changed by new documents', () => {
    const ex = loadExample<{
      confirmed: { field: string; value: string };
      values: { id: string; kind: DocumentInput['kind']; value: string }[];
      expect: { target: { value: string; status: string }; suggestionDiffers: boolean; suggestion: string };
    }>('M16', 'M16-EX-stability');
    const documents = ex.values.map((v) => ({ id: v.id, kind: v.kind, fields: { [ex.confirmed.field]: v.value } }));
    const targets = { [ex.confirmed.field]: { value: ex.confirmed.value, status: 'confirmed' } as Target };
    const a = analyse({ documents, targets }, ctx);
    const f = a.fields.find((x) => x.field === ex.confirmed.field)!;
    expect({ value: f.target!.value, status: f.target!.status }).toEqual(ex.expect.target);
    expect(f.suggestionDiffers).toBe(ex.expect.suggestionDiffers);
    expect(f.suggestion!.display).toBe(ex.expect.suggestion);
  });
});

// ---------------------------------------------------------------- M18

type ExpectedStep = { kind: string; fields?: string[]; document?: string; rule?: string | null; verified?: boolean; reason?: string; dependsOn?: string[] };
const simplify = (steps: RoadmapStep[]): ExpectedStep[] =>
  steps.map((s) =>
    s.kind === 'correction'
      ? { kind: s.kind, document: s.document, rule: s.rule?.id ?? null, verified: s.verified, reason: s.reason, ...(s.dependsOn.length ? { dependsOn: s.dependsOn } : {}) }
      : s.kind === 'confirm_targets'
        ? { kind: s.kind, fields: s.fields }
        : { kind: s.kind },
  );
const pick = (expected: ExpectedStep[], actual: ExpectedStep[]) =>
  actual.map((a, i) => Object.fromEntries(Object.keys(expected[i] ?? a).map((k) => [k, (a as Record<string, unknown>)[k]])));
const toTargets = (t: Record<string, FieldValue> | undefined) =>
  t ? Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { value: v, status: 'confirmed' } as Target])) : undefined;

describe('M18 correction roadmap', () => {
  const prd = loadExample<{
    jurisdiction: string;
    asOf: string;
    documents: DocumentInput[];
    withoutConfirmedTarget: { steps: ExpectedStep[] };
    withConfirmedTarget: { targets: Record<string, string>; steps: ExpectedStep[] };
  }>('M18', 'M18-EX-prd-scenario');

  it('@M18-AC-1.1 @M18-AC-1.2 @M18-AC-5.1 M18-EX-prd-scenario — order with and without a confirmed target', () => {
    const opts = { jurisdiction: prd.jurisdiction, asOf: prd.asOf };
    const without = simplify(buildRoadmap(analyse({ documents: prd.documents }, ctx), ctx, opts).steps);
    expect(pick(prd.withoutConfirmedTarget.steps, without)).toEqual(prd.withoutConfirmedTarget.steps);
    const confirmed = analyse({ documents: prd.documents, targets: toTargets(prd.withConfirmedTarget.targets) }, ctx);
    const withTarget = simplify(buildRoadmap(confirmed, ctx, opts).steps);
    expect(pick(prd.withConfirmedTarget.steps, withTarget)).toEqual(prd.withConfirmedTarget.steps);
  });

  it('@M18-AC-1.3 M18-EX-prerequisites — prerequisites come first and are listed', () => {
    const ex = loadExample<{ jurisdiction: string; asOf: string; targets: Record<string, FieldValue>; documents: DocumentInput[]; steps: ExpectedStep[] }>('M18', 'M18-EX-prerequisites');
    const a = analyse({ documents: ex.documents, targets: toTargets(ex.targets) }, ctx);
    const steps = simplify(buildRoadmap(a, ctx, { jurisdiction: ex.jurisdiction, asOf: ex.asOf }).steps);
    expect(pick(ex.steps, steps)).toEqual(ex.steps);
  });

  const withRules = (rules: Partial<CorrectionRule>[]): KnowledgeBase => {
    const base = seedKnowledgeBase.rules[0]!;
    return {
      ...seedKnowledgeBase,
      jurisdictions: [...seedKnowledgeBase.jurisdictions],
      rules: rules.map((r) => ({ ...base, prerequisites: [], fields: ['name'], fees: [], ...r, meta: { ...base.meta, ...r.meta } }) as CorrectionRule),
    };
  };

  it('@M18-AC-1.4 M18-EX-cycle — a prerequisite cycle falls back to tier order with a warning', () => {
    const ex = loadExample<{ documents: DocumentInput[]; targets: Record<string, string>; asOf: string; rules: { id: string; document: string; prerequisite: string }[]; expect: { order: string[]; warnings: string[] } }>(
      'M18',
      'M18-EX-cycle',
    );
    const kb = withRules(
      ex.rules.map((r) => ({ id: r.id, document: r.document as never, prerequisites: [{ document: r.prerequisite as never, fields: ['name'], reason: seedKnowledgeBase.rules[1]!.prerequisites[0]!.reason }] })),
    );
    const c = createContext(kb);
    const map = buildRoadmap(analyse({ documents: ex.documents, targets: toTargets(ex.targets) }, c), c, { jurisdiction: 'IN-KA', asOf: ex.asOf });
    expect(map.steps.filter((s): s is CorrectionStep => s.kind === 'correction').map((s) => s.document)).toEqual(ex.expect.order);
    expect(map.warnings.map((w) => w.kind)).toEqual(ex.expect.warnings);
    expect(map.warnings[0]!.rules).toEqual(['a-rule', 'p-rule']);
  });

  it('@M18-AC-4.1 @M18-AC-4.2 M18-EX-jurisdiction — most specific usable rule; never another state; drafts and expired rules unused', () => {
    const ex = loadExample<{
      documents: DocumentInput[];
      targets: Record<string, string>;
      asOf: string;
      rules: { id: string; jurisdiction: string; priority: number; status: string; effectiveTo?: string }[];
      cases: { jurisdiction: string; rule: string }[];
    }>('M18', 'M18-EX-jurisdiction');
    const kb = withRules(
      ex.rules.map((r) => ({
        id: r.id,
        document: 'driving_licence' as const,
        jurisdiction: r.jurisdiction,
        priority: r.priority,
        meta: { ...seedKnowledgeBase.rules[0]!.meta, status: r.status as never, ...(r.effectiveTo ? { effectiveTo: r.effectiveTo } : {}) },
      })),
    );
    kb.jurisdictions.push({ code: 'IN-MH', name: kb.jurisdictions[0]!.name }, { code: 'IN-TN', name: kb.jurisdictions[0]!.name }, { code: 'IN-KA-BLR', name: kb.jurisdictions[0]!.name });
    const c = createContext(kb);
    const a = analyse({ documents: ex.documents, targets: toTargets(ex.targets) }, c);
    for (const k of ex.cases) {
      const step = buildRoadmap(a, c, { jurisdiction: k.jurisdiction, asOf: ex.asOf }).steps.find((s): s is CorrectionStep => s.kind === 'correction')!;
      expect(step.rule?.id, k.jurisdiction).toBe(k.rule);
    }
  });

  it('@M18-AC-2.1 @M18-AC-2.2 every step carries reason, rule version, sources and verification — or names the authority with nothing invented', () => {
    const a = analyse({ documents: prd.documents }, ctx);
    const steps = buildRoadmap(a, ctx, { jurisdiction: prd.jurisdiction, asOf: prd.asOf }).steps.filter((s): s is CorrectionStep => s.kind === 'correction');
    for (const s of steps) {
      expect(s.reason).toBeTruthy();
      expect(s.verified).toBe(false);
      expect(s.lastVerified).toBeNull();
      if (s.rule) {
        expect(s.rule.version).toBeGreaterThan(0);
        expect(s.sources.length).toBeGreaterThan(0);
      } else {
        expect(s.authority).toBe('ka-registrar-births');
        expect(s.sources).toEqual([]);
        expect(s.governmentFees).toEqual([]);
      }
    }
  });

  it('@M18-AC-3.1 @M18-AC-3.2 government fees come from the rule; the 1dentity service fee is separate and "to be confirmed" until priced', () => {
    const a = analyse({ documents: prd.documents, targets: toTargets({ name: 'Mohammed Ibrahim' }) }, ctx);
    const pan = buildRoadmap(a, ctx, { jurisdiction: 'IN-KA', asOf: '2026-11-02' }).steps.find((s): s is CorrectionStep => s.kind === 'correction' && s.documentKind === 'pan')!;
    expect(pan.governmentFees.map((f) => f.id)).toEqual(['pan-cr-01-fee']);
    expect(pan.serviceFee).toBeNull();
    const priced: KnowledgeBase = {
      ...seedKnowledgeBase,
      servicePrices: [{ id: 'assist', service: 'assistance', amountInr: 299, meta: { owner: 'Admin', source: 'Pricing', version: 1, status: 'published' } }],
    };
    const c = createContext(priced);
    const step = buildRoadmap(analyse({ documents: prd.documents }, c), c, { jurisdiction: 'IN-KA', asOf: '2026-11-02' }).steps.find((s): s is CorrectionStep => s.kind === 'correction')!;
    expect(step.serviceFee?.amountInr).toBe(299);
    expect(step.governmentFees.some((f) => f.id === step.serviceFee?.id)).toBe(false);
  });

  it('@M18-AC-5.1 no issues → an empty roadmap', () => {
    const a = analyse({ documents: [{ id: 'aadhaar', kind: 'aadhaar', fields: { name: 'Mohammed Ibrahim' } }] }, ctx);
    expect(buildRoadmap(a, ctx, { jurisdiction: 'IN-KA', asOf: '2026-11-02' })).toEqual({ steps: [], warnings: [] });
  });
});
