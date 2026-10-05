/** M17-FR-04 · Deterministic field extraction from OCR text. Nothing here is trusted until the citizen confirms it (C-17). */
import { catalogueEntry, seedKnowledgeBase, type DocumentKind, type KnowledgeBase } from '@identity/content';
import { detectKind } from './detect';
import { findMrzLines, parseMrz } from './mrz';
import type { ExtractedField, Extraction, OcrWord, RelativeType } from './types';

const LABELS: { field: keyof Extraction['fields'] | 'husband_name'; re: RegExp }[] = [
  { field: 'father_name', re: /^(?:father'?s?|fathers)\s*(?:\/\s*guardian'?s?\s*)?name\b|^father\b|^s\/o\b|^son of\b/i },
  { field: 'mother_name', re: /^(?:mother'?s?|mothers)\s*name\b|^mother\b/i },
  { field: 'husband_name', re: /^(?:husband'?s?|husbands)\s*name\b|^w\/o\b|^wife of\b/i },
  { field: 'spouse_name', re: /^(?:spouse'?s?|name of spouse)\s*(?:name)?\b/i },
  { field: 'place_of_birth', re: /^place of birth\b/i },
  { field: 'dob', re: /^(?:date of birth|d\.?\s?o\.?\s?b\.?|birth date|year of birth)\b/i },
  { field: 'gender', re: /^(?:gender|sex)\b/i },
  { field: 'address_line', re: /^address\b/i },
  { field: 'name', re: /^(?:name|elector'?s name|candidate'?s?\s*name|student'?s?\s*name|applicant'?s?\s*name|name of (?:the )?(?:candidate|student|child|applicant|holder))\b/i },
];

const DATE = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[\s-][A-Za-z]{3,9}[\s-]\d{4}|\b\d{4}\b)/;
const GENDER_WORD = /^(?:[^A-Za-z]*\/\s*)?(male|female|transgender|m|f|t)$/i;

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Value after the label on the same line ("Name : X") or on the next line. */
function labelled(all: string[], i: number, re: RegExp): string | undefined {
  const rest = all[i]!.replace(re, '').replace(/^[\s:.\-–]+/, '').trim();
  if (rest) return rest;
  const next = all[i + 1];
  return next && !LABELS.some((l) => l.re.test(next)) ? next : undefined;
}

function confidenceOf(value: string, words: OcrWord[] | undefined, fallback: number): number {
  if (!words?.length) return fallback;
  const tokens = value.toUpperCase().split(/\s+/).filter(Boolean);
  const scores = tokens.map((tok) => words.find((w) => w.text.toUpperCase().replace(/[^\w/-]/g, '') === tok.replace(/[^\w/-]/g, ''))?.confidence).filter((c): c is number => c !== undefined);
  return scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : fallback;
}

const NUMBER_PATTERNS: Partial<Record<DocumentKind, RegExp>> = {
  pan: /\b([A-Z]{5}[0-9]{4}[A-Z])\b/,
  voter_id: /\b([A-Z]{3}[0-9]{7})\b/,
  passport: /\b([A-Z][0-9]{7})\b/,
  driving_licence: /\b([A-Z]{2}\d{2}[\s-]?\d{11})\b/,
};
const MASKED_AADHAAR = /(?:[Xx*]{4})[\s-]?(?:[Xx*]{4})[\s-]?(\d{4})\b/;

export interface ExtractOptions {
  /** The type the citizen chose; detection only informs (M17-AC-3.5). */
  kind?: DocumentKind;
  words?: OcrWord[];
  /** Confidence when word-level data is absent (1 for text-layer PDFs). */
  defaultConfidence?: number;
  kb?: KnowledgeBase;
}

export function extractFields(text: string, options: ExtractOptions = {}): Extraction & { detectedKind: DocumentKind | null } {
  const kb = options.kb ?? seedKnowledgeBase;
  const detectedKind = detectKind(text);
  const kind = options.kind ?? detectedKind;
  const fallback = options.defaultConfidence ?? 1;
  const all = lines(text);
  const out: Extraction = { kind, fields: {} };
  const set = (field: keyof Extraction['fields'], value: string | undefined) => {
    const v = value?.trim();
    if (v && !out.fields[field]) out.fields[field] = { value: v, confidence: confidenceOf(v, options.words, fallback) } satisfies ExtractedField;
  };
  let husband: string | undefined;

  all.forEach((line, i) => {
    for (const { field, re } of LABELS) {
      if (!re.test(line)) continue;
      const v = labelled(all, i, re);
      if (field === 'dob') set('dob', v ? DATE.exec(v)?.[1] : undefined);
      else if (field === 'gender') set('gender', v?.split(/\s+/)[0]);
      else if (field === 'husband_name') husband ??= v;
      else if (field === 'address_line') {
        const block = [v, ...all.slice(i + 2, i + 5).filter((l) => !LABELS.some((x) => x.re.test(l)))].filter(Boolean).join(', ');
        const pin = /\b(\d{3}\s?\d{3})\b(?!.*\b\d{3}\s?\d{3}\b)/.exec(block)?.[1];
        set('address_line', pin ? block.replace(pin, '').replace(/[\s,-]+$/, '') : block);
        if (pin) set('address_pin', pin.replace(/\s/g, ''));
      } else set(field, v);
      break;
    }
  });

  // Inline "DOB: 12/04/2002" style when the label regex matched mid-line.
  if (!out.fields.dob) {
    const m = /(?:DOB|Date of Birth|Year of Birth)\s*[:\-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{4})/i.exec(text);
    if (m) set('dob', m[1]);
  }
  // A standalone gender line (Aadhaar prints "Male" on its own).
  if (!out.fields.gender) {
    const g = all.find((l) => GENDER_WORD.test(l));
    if (g) set('gender', GENDER_WORD.exec(g)![1]);
  }

  if (kind === 'aadhaar') {
    // The name is the line just before the date-of-birth line, below the header.
    const dobLine = all.findIndex((l) => /DOB|Date of Birth|Year of Birth/i.test(l));
    const candidate = dobLine > 0 ? all[dobLine - 1] : undefined;
    if (candidate && /^[A-Za-z][A-Za-z .']+$/.test(candidate) && !/government|india|authority/i.test(candidate)) set('name', candidate);
    const masked = MASKED_AADHAAR.exec(text);
    if (masked) out.last4 = masked[1];
  }

  if (kind === 'passport') {
    const mrzLines = findMrzLines(text);
    const mrz = mrzLines ? parseMrz(mrzLines) : null;
    if (mrz?.checksOk) {
      set('name', mrz.name);
      set('dob', mrz.dob);
      set('gender', mrz.gender);
      out.number = mrz.number;
    }
  }

  const numberRe = kind ? NUMBER_PATTERNS[kind] : undefined;
  if (numberRe && !out.number) {
    const m = numberRe.exec(text.toUpperCase());
    if (m) out.number = m[1]!.replace(/\s/g, '');
  }

  // Map parents' and spouse's names onto "relative" for documents that print one relative (M02-FR-21).
  if (kind) {
    const printed = catalogueEntry(kb, kind).fields.map((f) => f.field);
    if (printed.includes('relative_name') && !out.fields.relative_name) {
      const rel: [keyof Extraction['fields'] | 'husband', RelativeType][] = [
        ['father_name', 'father'],
        ['husband', 'husband'],
        ['mother_name', 'mother'],
      ];
      for (const [field, type] of rel) {
        const value = field === 'husband' ? husband : out.fields[field as keyof Extraction['fields']]?.value;
        if (value) {
          set('relative_name', value);
          out.relativeType = type;
          break;
        }
      }
      delete out.fields.father_name;
      delete out.fields.mother_name;
    } else if (husband && printed.includes('spouse_name')) set('spouse_name', husband);
    // Keep only fields this document prints.
    for (const f of Object.keys(out.fields) as (keyof Extraction['fields'])[]) {
      const base = f === 'address_line' || f === 'address_pin' ? 'address' : f;
      if (!printed.includes(base as never)) delete out.fields[f];
    }
  }
  return { ...out, detectedKind };
}
