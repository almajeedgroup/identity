import type { Dob } from './types';

/** Parse "DD-MM-YYYY" or "YYYY" (year-only). Returns undefined for anything else or an impossible date. */
export function parseDob(value: string): Dob | undefined {
  const v = value.trim();
  const yearOnly = /^(\d{4})$/.exec(v);
  if (yearOnly) return validYear(+yearOnly[1]!) ? { year: +yearOnly[1]! } : undefined;
  const full = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(v);
  if (!full) return undefined;
  return makeDob(+full[3]!, +full[2]!, +full[1]!);
}

export function makeDob(year: number, month?: number, day?: number): Dob | undefined {
  if (!validYear(year)) return undefined;
  if (month === undefined && day === undefined) return { year };
  if (month === undefined || day === undefined) return undefined;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return undefined;
  return { year, month, day };
}

function validYear(year: number): boolean {
  return Number.isInteger(year) && year >= 1900 && year <= 2100;
}
