import { describe, expect, it } from 'vitest';
import { loadExample } from '../../../tools/spec/specs';
import { daysBetween, todayInIndia } from './dates';
import { checkOfficialUrl } from './officialLinks';
import { appliesOn, freshness, resolveFees, upcomingExpiries } from './rules';
import { LOCALES, type ContentBundle } from './schema';
import { seedBundle } from './seed';
import { validateBundle } from './validate';

const clone = (): ContentBundle => structuredClone(seedBundle);

describe('F02 content model', () => {
  it('@F02-AC-5.1 the seed bundle validates and has a version', () => {
    const result = validateBundle(seedBundle);
    expect(result.ok ? [] : result.errors).toEqual([]);
    expect(seedBundle.version).toMatch(/\S/);
  });

  it('@F02-AC-1.1 items without owner, source or version are rejected and named', () => {
    const b = clone() as unknown as { actions: { meta: Record<string, unknown> }[] };
    delete b.actions[0]!.meta.owner;
    b.actions[1]!.meta.source = '';
    delete b.actions[2]!.meta.version;
    const result = validateBundle(b);
    expect(result.ok).toBe(false);
    const errors = result.ok ? [] : result.errors.join('\n');
    expect(errors).toContain('actions.0.meta.owner');
    expect(errors).toContain('actions.1.meta.source');
    expect(errors).toContain('actions.2.meta.version');
  });

  it('@F02-AC-1.2 F02-EX-freshness', () => {
    const ex = loadExample<{ cases: { lastVerified: string | null; asOf: string; expect: string }[] }>('F02', 'F02-EX-freshness');
    for (const c of ex.cases) expect(freshness({ lastVerified: c.lastVerified }, c.asOf), JSON.stringify(c)).toBe(c.expect);
  });

  it('F02-FR-09 seed values are not marked verified until checked on the official portal', () => {
    const metas = [
      ...seedBundle.documents.map((d) => d.meta),
      ...seedBundle.links.map((l) => l.meta),
      ...seedBundle.actions.flatMap((a) => [a.meta, ...a.fees.map((f) => f.meta)]),
    ];
    for (const m of metas) {
      expect(m.lastVerified ?? null).toBeNull();
      expect(m.source).toContain('DPR v1.0');
    }
  });

  it('@F02-AC-2.1 F02-EX-allowlist', () => {
    const ex = loadExample<{ allowed: string[]; rejected: { url: string; reason: string }[] }>('F02', 'F02-EX-allowlist');
    for (const url of ex.allowed) expect(checkOfficialUrl(url).ok, url).toBe(true);
    for (const r of ex.rejected) expect(checkOfficialUrl(r.url), r.url).toEqual({ ok: false, reason: r.reason });
  });

  it('@F02-AC-2.1 a non-official link fails bundle validation with the reason', () => {
    const b = clone();
    b.links[0]!.url = 'https://aadhaar-update-help.com/';
    const result = validateBundle(b);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.errors.join('\n')).toMatch(/links\.0\.url: link rejected: not_official/);
  });

  it('@F02-AC-3.1 F02-EX-effective-dates', () => {
    const ex = loadExample<{
      fee: { effectiveTo: string };
      cases: { asOf: string; applies: boolean }[];
      feeWithStart: { effectiveFrom: string };
      casesWithStart: { asOf: string; applies: boolean }[];
    }>('F02', 'F02-EX-effective-dates');
    for (const c of ex.cases) expect(appliesOn({ ...ex.fee, status: 'published' }, c.asOf), c.asOf).toBe(c.applies);
    for (const c of ex.casesWithStart) expect(appliesOn({ ...ex.feeWithStart, status: 'published' }, c.asOf), c.asOf).toBe(c.applies);
  });

  it('@F02-AC-3.1 the free myAadhaar document update stops showing after 14 June 2027 without a code change', () => {
    const action = seedBundle.actions.find((a) => a.id === 'aadhaar-document-update')!;
    expect(resolveFees(action, '2027-06-14').map((f) => f.id)).toEqual(['aadhaar-document-update-online-free']);
    expect(resolveFees(action, '2027-06-15')).toEqual([]);
  });

  it('@F02-AC-3.2 F02-EX-expiry-alert', () => {
    const ex = loadExample<{ cases: { effectiveTo: string; asOf: string; alert: boolean }[] }>('F02', 'F02-EX-expiry-alert');
    for (const c of ex.cases) {
      const b = clone();
      b.actions[0]!.meta.effectiveTo = c.effectiveTo;
      const alerts = upcomingExpiries(b, c.asOf).filter((a) => a.id === b.actions[0]!.id);
      expect(alerts.length > 0, JSON.stringify(c)).toBe(c.alert);
    }
  });

  it('@F02-AC-3.2 the seed bundle alerts the Aadhaar owner a month before the free update ends', () => {
    const alerts = upcomingExpiries(seedBundle, '2027-05-20');
    expect(alerts).toContainEqual(expect.objectContaining({ id: 'aadhaar-document-update-online-free', daysLeft: 25 }));
  });

  it('@F02-AC-4.1 citizen text missing a language fails validation', () => {
    for (const locale of LOCALES) {
      const b = clone() as unknown as { actions: { title: Record<string, string> }[] };
      delete b.actions[0]!.title[locale];
      const result = validateBundle(b);
      expect(result.ok, locale).toBe(false);
      expect(result.ok ? '' : result.errors.join('\n')).toContain(`actions.0.title.${locale}`);
    }
  });

  it('rejects broken cross-references and duplicate ids', () => {
    const b = clone();
    b.actions[0]!.links.push('no-such-link');
    b.actions[1]!.id = b.actions[0]!.id;
    const result = validateBundle(b);
    expect(result.ok ? [] : result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('unknown link "no-such-link"'),
        expect.stringContaining('is used more than once'),
      ]),
    );
  });

  it('computes dates in India time regardless of the device clock', () => {
    // 20:00 UTC on 1 Nov is 01:30 on 2 Nov in India.
    expect(todayInIndia(new Date('2026-11-01T20:00:00Z'))).toBe('2026-11-02');
    expect(daysBetween('2026-11-01', '2026-12-31')).toBe(60);
  });
});
