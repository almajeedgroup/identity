/** M17-FR-01/02 · Cleaning and validation of document values and numbers. Nothing that looks like a full Aadhaar number is kept (C-03). */
import { catalogueEntry, type DocumentKind, type KnowledgeBase, type PrintedField } from '@identity/content';
import { encryptValue, type Keyring } from '@identity/db';
import { displayAddress, normaliseGender, parseDate, words, type AddressValue, type DocumentFields, type RelativeType } from '@identity/engine';
import { containsFullAadhaar } from '@identity/ocr';
import { ServiceError } from './services';

export const RELATIVE_TYPES: readonly RelativeType[] = ['father', 'mother', 'husband', 'wife', 'other'];

/** The values a document carries: printed fields plus the relation of a relative's name. */
export type DocumentValues = DocumentFields;

/** Collapses whitespace; refuses (rather than silently cuts) values that are too long. */
export function cleanText(value: string, max: number): string {
  const v = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (v.length > max) throw new ServiceError('invalid_value');
  return v;
}

const ADDRESS_PARTS = ['line', 'city', 'district', 'state', 'pin'] as const;

export function cleanAddress(address: AddressValue): AddressValue {
  const out: AddressValue = {};
  for (const part of ADDRESS_PARTS) {
    const raw = address[part];
    if (typeof raw !== 'string') continue;
    const v = cleanText(raw, part === 'line' ? 300 : 80);
    if (v) out[part] = v;
  }
  if (out.pin && !/^\d{6}$/.test(out.pin)) throw new ServiceError('invalid_pin');
  return out;
}

/** M17-AC-1.1 · Only the fields the document prints; dates must be readable; a relative's name needs its relation. */
export function cleanValues(kb: KnowledgeBase, kind: DocumentKind, values: DocumentValues): DocumentValues {
  const printed = new Set<string>(catalogueEntry(kb, kind).fields.map((f) => f.field));
  const out: DocumentValues = {};
  for (const [key, raw] of Object.entries(values) as [keyof DocumentValues, unknown][]) {
    if (raw === undefined || raw === null || key === 'relative_type') continue;
    if (!printed.has(key)) throw new ServiceError('invalid_field');
    if (key === 'address') {
      if (typeof raw !== 'object') throw new ServiceError('invalid_value');
      const a = cleanAddress(raw as AddressValue);
      if (Object.keys(a).length) out.address = a;
      continue;
    }
    if (typeof raw !== 'string') throw new ServiceError('invalid_value');
    const v = cleanText(raw, 200);
    if (!v) continue;
    if (key === 'dob' && !parseDate(v)) throw new ServiceError('invalid_date');
    out[key] = v as never;
  }
  if (out.relative_name) {
    const relation = values.relative_type;
    if (!relation || !RELATIVE_TYPES.includes(relation)) throw new ServiceError('relative_type_required');
    out.relative_type = relation;
  }
  const text = Object.entries(out)
    .map(([k, v]) => (k === 'address' ? displayAddress(v as AddressValue) : String(v)))
    .join(' ');
  if (containsFullAadhaar(text)) throw new ServiceError('aadhaar_full_number');
  return out;
}

/** The stored rows of a document version: one per printed field, plus `relative_type`. */
export function valueEntries(values: DocumentValues): [PrintedField | 'relative_type', string | AddressValue][] {
  return Object.entries(values).filter(([, v]) => v !== undefined && v !== null) as [PrintedField | 'relative_type', string | AddressValue][];
}

/** F01-FR-10 · The normalised form kept beside the original. */
export function normalisedOf(field: string, value: string | AddressValue): string | null {
  if (typeof value !== 'string') return words(displayAddress(value)).join(' ') || null;
  if (field === 'relative_type') return value;
  if (field === 'gender') return normaliseGender(value);
  if (field === 'dob') {
    const d = parseDate(value);
    if (!d) return null;
    return [String(d.year), d.month && String(d.month).padStart(2, '0'), d.day && String(d.day).padStart(2, '0')].filter(Boolean).join('-');
  }
  return words(value).join(' ') || null;
}

const NUMBER_PATTERNS: Partial<Record<DocumentKind, RegExp>> = {
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  voter_id: /^[A-Z]{3}[0-9]{7}$/,
  passport: /^[A-Z][0-9]{7}$/,
};

export interface CleanNumber {
  encrypted: string | null;
  last4: string;
}

/** M17-FR-02 · Validated and encrypted; Aadhaar keeps only the last four digits and a full number is refused. */
export function cleanNumber(kb: KnowledgeBase, kind: DocumentKind, raw: string, keyring: Keyring): CleanNumber | null {
  const compact = raw.replace(/[\s-]/g, '').toUpperCase();
  if (!compact) return null;
  if (containsFullAadhaar(raw) || containsFullAadhaar(compact)) throw new ServiceError('aadhaar_full_number');
  if (catalogueEntry(kb, kind).numberStorage === 'last4_only') {
    if (/^\d{12}$/.test(compact)) throw new ServiceError('aadhaar_full_number');
    const last4 = compact.replace(/^[X*•]{8}/, '');
    if (!/^\d{4}$/.test(last4)) throw new ServiceError('invalid_number');
    return { encrypted: null, last4 };
  }
  const pattern = NUMBER_PATTERNS[kind];
  if (pattern ? !pattern.test(compact) : !/^[A-Z0-9/.]{1,40}$/.test(compact)) throw new ServiceError('invalid_number');
  return { encrypted: encryptValue(compact, keyring), last4: compact.slice(-4) };
}
