import { describe, expect, it } from 'vitest';
import { loadExample } from '../../../tools/spec/specs';
import { locales } from './config';
import { formatInr, formatIsoDate } from './format';
import { createTranslator, pluralForm } from './translate';

const ex = loadExample<{
  inr: { amount: number; expect: string }[];
  dates: { date: string; expect: string }[];
  plurals: { locale: (typeof locales)[number]; count: number; form: string }[];
}>('F04', 'F04-EX-formats');

describe('F04 formats', () => {
  it('@F04-AC-4.1 F04-EX-formats money uses Indian grouping and dates are DD-MM-YYYY in every locale', () => {
    for (const c of ex.inr) expect(formatInr(c.amount)).toBe(c.expect);
    for (const c of ex.dates) expect(formatIsoDate(c.date)).toBe(c.expect);
  });

  it('@F04-AC-4.2 F04-EX-formats plural forms follow each language', () => {
    for (const c of ex.plurals) expect(pluralForm(c.locale, c.count), `${c.locale} ${c.count}`).toBe(c.form);
    const t = createTranslator('en', { n_one: '{count} issue', n_other: '{count} issues' });
    expect(t('n', { count: 1 })).toBe('1 issue');
    expect(t('n', { count: 3 })).toBe('3 issues');
  });
});
