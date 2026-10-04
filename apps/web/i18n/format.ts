/** F04-FR-05 · Western digits, Indian grouping, DD-MM-YYYY — the same in every locale. */
import type { Dob } from '@identity/rules';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function formatInr(amount: number): string {
  return `₹${inr.format(amount)}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2027-06-14" → "14-06-2027" */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export function formatDob(dob: Dob): string {
  return dob.month && dob.day ? `${pad(dob.day)}-${pad(dob.month)}-${dob.year}` : String(dob.year);
}
