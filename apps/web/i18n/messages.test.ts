import { REASON_CODES, TIP_CODES } from '@identity/rules';
import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import hi from '../messages/hi.json';
import kn from '../messages/kn.json';
import ur from '../messages/ur.json';
import { createTranslator, type Messages } from './translate';

const all = { en, kn, hi, ur } as Record<'en' | 'kn' | 'hi' | 'ur', Messages>;

describe('M02 explanations in every language', () => {
  it('@M02-AC-2.2 every reason code and tip has a plain-language message in en, kn, hi and ur', () => {
    for (const [locale, messages] of Object.entries(all) as ['en' | 'kn' | 'hi' | 'ur', Messages][]) {
      const t = createTranslator(locale, messages);
      for (const code of REASON_CODES) {
        const text = t(`reason.${code}`, { document: 'PAN', reference: 'Aadhaar' });
        expect(text, `${locale} reason.${code}`).not.toMatch(/\{\w+\}/);
        expect(text.length).toBeGreaterThan(10);
      }
      for (const tip of TIP_CODES) expect(t(`tip.${tip}`).length, `${locale} tip.${tip}`).toBeGreaterThan(10);
    }
  });
});
