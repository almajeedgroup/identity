import { describe, expect, it } from 'vitest';
import { loadExample } from '../../../../tools/spec/specs';
import { DOCUMENT_KINDS, type KnowledgeBase } from './schema';
import { authorityFor, jurisdictionApplies, selectRule, servicePriceFor } from './lookup';
import { seedKnowledgeBase } from './seed';
import { validateKnowledgeBase } from './validate';

const clone = (): KnowledgeBase => structuredClone(seedKnowledgeBase);

describe('F02 v0.3 knowledge base', () => {
  it('the seed knowledge base validates', () => {
    const r = validateKnowledgeBase(seedKnowledgeBase);
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it('@F02-AC-6.1 F02-EX-catalogue lists the 11 PRD documents with tiers, fields, number handling and authorities', () => {
    const ex = loadExample<{ documents: string[]; tiers: Record<string, number> }>('F02', 'F02-EX-catalogue');
    expect(seedKnowledgeBase.catalogue.map((c) => c.kind)).toEqual(ex.documents);
    expect([...DOCUMENT_KINDS]).toEqual(ex.documents);
    for (const c of seedKnowledgeBase.catalogue) {
      expect(c.tier, c.kind).toBe(ex.tiers[c.kind]);
      expect(c.fields.length).toBeGreaterThan(0);
      expect(authorityFor(seedKnowledgeBase, c.kind, 'IN-KA'), c.kind).not.toBeNull();
    }
    // C-03: Aadhaar numbers are never stored in full.
    expect(seedKnowledgeBase.catalogue.find((c) => c.kind === 'aadhaar')!.numberStorage).toBe('last4_only');
  });

  it('@F02-AC-7.1 rules missing parts or pointing at unknown entities fail, naming the rule', () => {
    const missing = clone() as unknown as { rules: Record<string, unknown>[] };
    delete missing.rules[0]!.steps;
    const r1 = validateKnowledgeBase(missing);
    expect(r1.ok ? '' : r1.errors.join('\n')).toContain('rules.0.steps');

    const unknown = clone();
    unknown.rules[1]!.authority = 'no-such-authority';
    unknown.rules[1]!.sources = ['no-such-source'];
    unknown.rules[1]!.jurisdiction = 'IN-MH';
    const r2 = validateKnowledgeBase(unknown);
    expect(r2.ok ? [] : r2.errors).toEqual(
      expect.arrayContaining([
        'rule "pan-name-dob-correction": unknown jurisdiction "IN-MH"',
        'rule "pan-name-dob-correction": unknown authority "no-such-authority"',
        'rule "pan-name-dob-correction": unknown source "no-such-source"',
      ]),
    );
  });

  it('@F02-AC-7.2 version history must increase and end at the current version', () => {
    const decreasing = clone();
    decreasing.rules[0]!.history = [
      { version: 2, date: '2026-10-05', change: 'b', by: 'x' },
      { version: 1, date: '2026-10-06', change: 'a', by: 'x' },
    ];
    const r1 = validateKnowledgeBase(decreasing);
    expect(r1.ok ? [] : r1.errors).toEqual(['rule "aadhaar-demographic-update": history versions must increase']);

    const ahead = clone();
    ahead.rules[0]!.history = [
      { version: 1, date: '2026-10-05', change: 'a', by: 'x' },
      { version: 2, date: '2026-10-06', change: 'b', by: 'x' },
    ];
    const r2 = validateKnowledgeBase(ahead);
    expect(r2.ok ? [] : r2.errors).toEqual(['rule "aadhaar-demographic-update": latest history entry must match version 1']);
  });

  it('@F02-AC-8.1 the seed invents nothing: rules only for DPR-described procedures, none verified', () => {
    const ex = loadExample<{ rulesOnlyFor: string[] }>('F02', 'F02-EX-catalogue');
    expect([...new Set(seedKnowledgeBase.rules.map((r) => r.document))].sort()).toEqual([...ex.rulesOnlyFor].sort());
    for (const r of seedKnowledgeBase.rules) {
      expect(r.meta.source, r.id).toContain('DPR v1.0');
      expect(r.meta.lastVerified ?? null, r.id).toBeNull();
      for (const f of r.fees) expect(f.meta.lastVerified ?? null).toBeNull();
    }
    for (const s of seedKnowledgeBase.sources) expect(s.meta.lastVerified ?? null, s.id).toBeNull();
    for (const kind of DOCUMENT_KINDS.filter((k) => !ex.rulesOnlyFor.includes(k))) {
      expect(seedKnowledgeBase.rules.some((r) => r.document === kind), kind).toBe(false);
    }
  });

  it('@F02-AC-9.1 F02-EX-dictionaries — no word in two groups; known renamings map together', () => {
    const kb = clone();
    kb.placeVariants.groups.push({ canonical: 'banglore', variants: ['banglore'] });
    const r = validateKnowledgeBase(kb);
    expect(r.ok ? '' : r.errors.join('\n')).toContain('place "banglore" is in groups "bengaluru" and "banglore"');

    const ex = loadExample<{ places: { a: string; b: string; same: boolean }[]; abbreviations: { short: string; long: string }[] }>('F02', 'F02-EX-dictionaries');
    const canonical = (w: string) => seedKnowledgeBase.placeVariants.groups.find((g) => g.variants.includes(w.toLowerCase()))?.canonical ?? w.toLowerCase();
    for (const p of ex.places) expect(canonical(p.a) === canonical(p.b), `${p.a}/${p.b}`).toBe(p.same);
    for (const a of ex.abbreviations) expect(seedKnowledgeBase.addressAbbreviations.entries).toContainEqual(a);
  });

  it('@F02-AC-9.2 service prices are 1dentity services only; an empty list means "to be confirmed"', () => {
    expect(servicePriceFor(seedKnowledgeBase, 'assistance', 'pan', '2026-11-02')).toBeNull();
    const kb = clone();
    kb.servicePrices.push({
      id: 'assistance-default',
      service: 'assistance',
      amountInr: 299,
      meta: { owner: 'Admin', source: 'Pricing decision', version: 1, status: 'published' },
    });
    expect(validateKnowledgeBase(kb).ok).toBe(true);
    expect(servicePriceFor(kb, 'assistance', 'pan', '2026-11-02')?.amountInr).toBe(299);
    const bad = clone() as unknown as { servicePrices: Record<string, unknown>[] };
    bad.servicePrices.push({ id: 'gov', service: 'government_fee', amountInr: 75, meta: { owner: 'x', source: 'y', version: 1, status: 'published' } });
    expect(validateKnowledgeBase(bad).ok).toBe(false);
  });

  it('jurisdiction codes apply downwards only', () => {
    expect(jurisdictionApplies('IN', 'IN-KA-BLR')).toBe(true);
    expect(jurisdictionApplies('IN-KA', 'IN-KA')).toBe(true);
    expect(jurisdictionApplies('IN-KA', 'IN-KAR')).toBe(false);
    expect(jurisdictionApplies('IN-KA', 'IN')).toBe(false);
    expect(selectRule(seedKnowledgeBase, 'pan', 'name', 'IN-KA', '2026-11-02')?.id).toBe('pan-name-dob-correction');
    expect(selectRule(seedKnowledgeBase, 'passport', 'name', 'IN-KA', '2026-11-02')).toBeNull();
  });
});
