/** M17-FR-05 · document type from keywords. */
import type { DocumentKind } from '@identity/content';

const RULES: [DocumentKind, (t: string) => boolean][] = [
  ['pan', (t) => t.includes('INCOME TAX DEPARTMENT') || t.includes('PERMANENT ACCOUNT NUMBER')],
  ['aadhaar', (t) => t.includes('UNIQUE IDENTIFICATION AUTHORITY') || /\bAADHAAR\b/.test(t)],
  ['voter_id', (t) => t.includes('ELECTION COMMISSION OF INDIA')],
  ['passport', (t) => /P<IND/.test(t.replace(/\s+/g, '')) || (t.includes('REPUBLIC OF INDIA') && t.includes('PASSPORT'))],
  ['driving_licence', (t) => t.includes('DRIVING LICENCE') || t.includes('DRIVING LICENSE')],
  ['sslc', (t) => t.includes('SECONDARY SCHOOL LEAVING')],
  ['puc', (t) => t.includes('PRE-UNIVERSITY') || t.includes('PRE UNIVERSITY')],
  ['birth_certificate', (t) => t.includes('BIRTH') && t.includes('CERTIFICATE')],
  ['caste_certificate', (t) => t.includes('CASTE CERTIFICATE')],
  ['income_certificate', (t) => t.includes('INCOME CERTIFICATE')],
  ['ration_card', (t) => t.includes('RATION CARD')],
];

export function detectKind(text: string): DocumentKind | null {
  const t = text.toUpperCase();
  return RULES.find(([, test]) => test(t))?.[0] ?? null;
}
