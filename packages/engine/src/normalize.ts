/** M02-FR-16 … 20 · Safe normalisation and pairwise comparison for each kind of field. */
import { hasRelatedPermutation, normaliseName, tokenRelation, type NameDictionary, type TokenRelation } from '@identity/rules';
import type { EngineContext } from './context';
import type { AddressValue, Comparison, FieldValue } from './types';
import type { ComparedField } from '@identity/content';

/** Lower-case words, punctuation as spaces (no honorific removal). */
export function words(value: string): string[] {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---------------------------------------------------------------- names

const STRENGTH: Record<Exclude<TokenRelation, 'different'>, number> = { equal: 0, transliteration: 1, abbreviation: 2, initials: 3 };

/** Every word of `short` pairs with a distinct, related word of `long`. */
function relatedSubset(short: string[], long: string[], dict: NameDictionary): boolean {
  const used = new Array<boolean>(long.length).fill(false);
  const visit = (i: number): boolean => {
    if (i === short.length) return true;
    for (let j = 0; j < long.length; j++) {
      if (!used[j] && tokenRelation(short[i]!, long[j]!, dict) !== 'different') {
        used[j] = true;
        if (visit(i + 1)) return true;
        used[j] = false;
      }
    }
    return false;
  };
  return visit(0);
}

/** M02-FR-16 — never "likely equivalent" for names (C-18). */
export function compareNames(a: string, b: string, dict: NameDictionary): Comparison {
  if (a.trim() === b.trim()) return { status: 'exact_match' };
  if (sameList(words(a), words(b))) return { status: 'formatting_variation', reason: 'case_or_punctuation' };
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (sameList(na, nb)) return { status: 'formatting_variation', reason: 'honorific' };
  if (na.join('') === nb.join('')) return { status: 'potential_discrepancy', reason: 'spacing' };
  if (na.length === nb.length) {
    const relations = na.map((x, i) => tokenRelation(x, nb[i]!, dict));
    if (!relations.includes('different')) {
      const strongest = (relations as Exclude<TokenRelation, 'different'>[]).reduce((s, r) => (STRENGTH[r] > STRENGTH[s] ? r : s), 'equal');
      return { status: 'potential_discrepancy', reason: strongest === 'equal' ? 'spacing' : strongest };
    }
    if (hasRelatedPermutation(na, nb, dict)) return { status: 'potential_discrepancy', reason: 'word_order' };
    return { status: 'major_discrepancy', reason: 'different_name' };
  }
  const [short, long] = na.length < nb.length ? [na, nb] : [nb, na];
  if (short.length > 0 && relatedSubset(short, long, dict)) return { status: 'potential_discrepancy', reason: 'missing_or_extra_part' };
  return { status: 'major_discrepancy', reason: 'different_name' };
}

// ---------------------------------------------------------------- dates

export interface ParsedDate {
  year: number;
  month?: number;
  day?: number;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const monthOf = (name: string) => {
  const i = MONTHS.indexOf(name.toLowerCase().slice(0, 3));
  return i < 0 ? undefined : i + 1;
};

function valid(year: number, month: number, day: number): ParsedDate | null {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day && year >= 1800 && year <= 2200
    ? { year, month, day }
    : null;
}

/** M02-FR-17 — Indian day-first formats. */
export function parseDate(raw: string): ParsedDate | null {
  const v = raw.trim();
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})$/.exec(v))) return +m[1]! >= 1800 && +m[1]! <= 2200 ? { year: +m[1]! } : null;
  if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v))) return valid(+m[3]!, +m[2]!, +m[1]!);
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v))) return valid(+m[1]!, +m[2]!, +m[3]!);
  if ((m = /^(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?[\s,-]+(\d{4})$/.exec(v))) {
    const month = monthOf(m[2]!);
    return month ? valid(+m[3]!, month, +m[1]!) : null;
  }
  if ((m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(v))) {
    const month = monthOf(m[1]!);
    return month ? valid(+m[3]!, month, +m[2]!) : null;
  }
  return null;
}

export function compareDates(a: string, b: string): Comparison {
  if (a.trim() === b.trim()) return { status: 'exact_match' };
  const pa = parseDate(a);
  const pb = parseDate(b);
  if (!pa || !pb) return { status: 'potential_discrepancy', reason: 'unreadable_date' };
  const fullA = pa.month !== undefined;
  const fullB = pb.month !== undefined;
  if (!fullA && !fullB) return pa.year === pb.year ? { status: 'formatting_variation', reason: 'format_only' } : { status: 'major_discrepancy', reason: 'date_differs' };
  if (!fullA || !fullB) return pa.year === pb.year ? { status: 'potential_discrepancy', reason: 'year_only' } : { status: 'major_discrepancy', reason: 'date_differs' };
  if (pa.year === pb.year && pa.month === pb.month && pa.day === pb.day) return { status: 'formatting_variation', reason: 'format_only' };
  if (pa.year === pb.year && pa.day === pb.month && pa.month === pb.day && pa.day !== pa.month) return { status: 'potential_discrepancy', reason: 'day_month_swapped' };
  const isPlaceholder = (d: ParsedDate) => d.day === 1 && d.month === 1;
  if (pa.year === pb.year && (isPlaceholder(pa) || isPlaceholder(pb))) return { status: 'potential_discrepancy', reason: 'placeholder_date' };
  return { status: 'major_discrepancy', reason: 'date_differs' };
}

// ---------------------------------------------------------------- gender

const GENDERS: Record<string, string> = {
  m: 'male',
  male: 'male',
  man: 'male',
  f: 'female',
  female: 'female',
  woman: 'female',
  t: 'transgender',
  tg: 'transgender',
  transgender: 'transgender',
  'third gender': 'transgender',
  third: 'transgender',
  other: 'transgender',
};

export function normaliseGender(value: string): string {
  const w = words(value).join(' ');
  return GENDERS[w] ?? w;
}

export function compareGender(a: string, b: string): Comparison {
  if (a.trim() === b.trim()) return { status: 'exact_match' };
  return normaliseGender(a) === normaliseGender(b) ? { status: 'formatting_variation', reason: 'gender_format' } : { status: 'major_discrepancy', reason: 'gender_differs' };
}

// ---------------------------------------------------------------- places

const mapPlaces = (ws: string[], places: Map<string, string>) => ws.map((w) => places.get(w) ?? w);
const isSubset = (small: string[], big: string[]) => small.length < big.length && small.every((w) => big.includes(w));

export function comparePlaces(a: string, b: string, places: Map<string, string>): Comparison {
  if (a.trim() === b.trim()) return { status: 'exact_match' };
  const wa = words(a);
  const wb = words(b);
  if (sameList(wa, wb)) return { status: 'formatting_variation', reason: 'case_or_punctuation' };
  const ma = mapPlaces(wa, places);
  const mb = mapPlaces(wb, places);
  if (sameList(ma, mb)) return { status: 'likely_equivalent', reason: 'place_renamed' };
  if (isSubset(ma, mb) || isSubset(mb, ma)) return { status: 'potential_discrepancy', reason: 'place_partial' };
  return { status: 'major_discrepancy', reason: 'place_differs' };
}

// ---------------------------------------------------------------- address

export function displayAddress(a: AddressValue): string {
  return [a.line, a.city, a.district, a.state, a.pin].map((x) => x?.trim()).filter(Boolean).join(', ');
}

export function hasAddress(a: AddressValue | undefined): a is AddressValue {
  return !!a && displayAddress(a).length > 0;
}

type Part = 'same' | 'abbrev' | 'less' | 'differs';

function lineParts(a: string | undefined, b: string | undefined, ctx: EngineContext): Part {
  if (!a?.trim() || !b?.trim()) return a?.trim() || b?.trim() ? 'less' : 'same';
  const plain = (s: string) => words(s).filter((w) => !ctx.ignore.has(w));
  const pa = plain(a);
  const pb = plain(b);
  if (sameList(pa, pb)) return 'same';
  const expand = (ws: string[]) => ws.flatMap((w) => ctx.abbreviations.get(w) ?? [ctx.places.get(w) ?? w]);
  const ea = expand(pa);
  const eb = expand(pb);
  if (sameList(ea, eb)) return 'abbrev';
  const aInB = ea.every((w) => eb.includes(w));
  const bInA = eb.every((w) => ea.includes(w));
  if (aInB && bInA) return 'abbrev'; // same words, different order
  return aInB || bInA ? 'less' : 'differs';
}

export function compareAddresses(a: AddressValue, b: AddressValue, ctx: EngineContext): Comparison {
  if (displayAddress(a) === displayAddress(b)) return { status: 'exact_match' };
  const pinA = a.pin?.replace(/\D/g, '');
  const pinB = b.pin?.replace(/\D/g, '');
  if (pinA && pinB && pinA !== pinB) return { status: 'major_discrepancy', reason: 'address_city_or_pin_differs' };
  let city: Part = 'same';
  if (a.city?.trim() && b.city?.trim()) {
    const wa = words(a.city);
    const wb = words(b.city);
    if (!sameList(wa, wb)) {
      if (!sameList(mapPlaces(wa, ctx.places), mapPlaces(wb, ctx.places))) return { status: 'major_discrepancy', reason: 'address_city_or_pin_differs' };
      city = 'abbrev';
    }
  } else if (a.city?.trim() || b.city?.trim()) city = 'less';
  const line = lineParts(a.line, b.line, ctx);
  if (line === 'differs') return { status: 'potential_discrepancy', reason: 'address_line_differs' };
  const pin: Part = !pinA !== !pinB ? 'less' : 'same';
  const oneSided = (x?: string, y?: string) => !x?.trim() !== !y?.trim();
  const region: Part = oneSided(a.district, b.district) || oneSided(a.state, b.state) ? 'less' : 'same';
  const parts = [city, line, pin, region];
  if (parts.includes('less')) return { status: 'likely_equivalent', reason: 'address_less_detail' };
  if (parts.includes('abbrev')) return { status: 'likely_equivalent', reason: 'address_abbreviation' };
  return { status: 'formatting_variation', reason: 'case_or_punctuation' };
}

// ---------------------------------------------------------------- dispatch

export function compareValues(field: ComparedField, a: FieldValue, b: FieldValue, ctx: EngineContext): Comparison {
  if (field === 'address') return compareAddresses(a as AddressValue, b as AddressValue, ctx);
  const x = a as string;
  const y = b as string;
  switch (field) {
    case 'dob':
      return compareDates(x, y);
    case 'gender':
      return compareGender(x, y);
    case 'place_of_birth':
      return comparePlaces(x, y, ctx.places);
    default:
      return compareNames(x, y, ctx.names);
  }
}

export function displayValue(value: FieldValue): string {
  return typeof value === 'string' ? value.trim() : displayAddress(value);
}
