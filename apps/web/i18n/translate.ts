/** F04-FR-04 · Flat message lookup with {placeholders} and _one/_other plural keys (ADR-006). */
import type { Locale } from './config';

export type Messages = { [key: string]: string | Messages };
export type Vars = Record<string, string | number>;
export type Translate = (key: string, vars?: Vars) => string;

export function flattenMessages(messages: Messages, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flattenMessages(value, path));
  }
  return out;
}

export function pluralForm(locale: Locale, count: number): Intl.LDMLPluralRule {
  return new Intl.PluralRules(locale).select(count);
}

export function createTranslator(locale: Locale, messages: Messages): Translate {
  const flat = flattenMessages(messages);
  return (key, vars) => {
    let resolved = key;
    if (vars && typeof vars.count === 'number') {
      const form = `${key}_${pluralForm(locale, vars.count)}`;
      resolved = form in flat ? form : `${key}_other`;
    }
    const template = flat[resolved];
    if (template === undefined) {
      if (process.env.NODE_ENV !== 'production') throw new Error(`Missing message "${resolved}" for ${locale}`);
      return key;
    }
    return template.replace(/\{(\w+)\}/g, (whole, name: string) => (vars && name in vars ? String(vars[name]) : whole));
  };
}
