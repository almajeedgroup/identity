/** M02-FR-04 / FR-05 · Name normalisation and classification. */
import type { NameVariantGroup } from '@identity/content';

export type NameReason =
  | 'spacing'
  | 'initials'
  | 'abbreviation'
  | 'transliteration'
  | 'word_order'
  | 'different_name'
  | 'missing_or_extra_part';

export type NameComparison =
  | { result: 'match' }
  | { result: 'variant'; reason: Extract<NameReason, 'spacing' | 'initials' | 'abbreviation' | 'transliteration' | 'word_order'> }
  | { result: 'different'; reason: Extract<NameReason, 'different_name' | 'missing_or_extra_part'> };

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'shri', 'sri', 'smt', 'kum', 'kumari', 'dr']);

export function normaliseName(value: string): string[] {
  const tokens = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length > 1 && HONORIFICS.has(tokens[0]!)) tokens.shift();
  return tokens;
}

export interface NameDictionary {
  get(token: string): { canonical: string; abbreviation: boolean } | undefined;
}

export function buildNameDictionary(groups: readonly NameVariantGroup[]): NameDictionary {
  const map = new Map<string, { canonical: string; abbreviation: boolean }>();
  for (const g of groups) {
    for (const v of g.variants) map.set(v, { canonical: g.canonical, abbreviation: false });
    for (const a of g.abbreviations) map.set(a, { canonical: g.canonical, abbreviation: true });
  }
  return map;
}

export type TokenRelation = 'equal' | 'transliteration' | 'abbreviation' | 'initials' | 'different';
const STRENGTH: Record<Exclude<TokenRelation, 'different'>, number> = {
  equal: 0,
  transliteration: 1,
  abbreviation: 2,
  initials: 3,
};

/** How two name words relate: shared by the Quick Check and the Full Check engine. */
export function tokenRelation(x: string, y: string, dict: NameDictionary): TokenRelation {
  if (x === y) return 'equal';
  const ex = dict.get(x);
  const ey = dict.get(y);
  if (ex && ey && ex.canonical === ey.canonical) return ex.abbreviation || ey.abbreviation ? 'abbreviation' : 'transliteration';
  if ((x.length === 1 && y.startsWith(x)) || (y.length === 1 && x.startsWith(y))) return 'initials';
  return 'different';
}

/** Is there a one-to-one pairing of tokens where every pair is related? (small inputs: backtracking) */
export function hasRelatedPermutation(a: string[], b: string[], dict: NameDictionary): boolean {
  const used = new Array<boolean>(b.length).fill(false);
  const visit = (i: number): boolean => {
    if (i === a.length) return true;
    for (let j = 0; j < b.length; j++) {
      if (!used[j] && tokenRelation(a[i]!, b[j]!, dict) !== 'different') {
        used[j] = true;
        if (visit(i + 1)) return true;
        used[j] = false;
      }
    }
    return false;
  };
  return visit(0);
}

export function compareNames(a: string, b: string, dict: NameDictionary): NameComparison {
  const ta = normaliseName(a);
  const tb = normaliseName(b);
  if (ta.join(' ') === tb.join(' ')) return { result: 'match' };
  if (ta.join('') === tb.join('')) return { result: 'variant', reason: 'spacing' };
  if (ta.length !== tb.length) return { result: 'different', reason: 'missing_or_extra_part' };

  const relations = ta.map((x, i) => tokenRelation(x, tb[i]!, dict));
  if (!relations.includes('different')) {
    const strongest = (relations as Exclude<TokenRelation, 'different'>[]).reduce((s, r) => (STRENGTH[r] > STRENGTH[s] ? r : s), 'equal');
    // 'equal' cannot be strongest here: identical token lists returned 'match' above.
    return { result: 'variant', reason: strongest as 'initials' | 'abbreviation' | 'transliteration' };
  }
  if (hasRelatedPermutation(ta, tb, dict)) return { result: 'variant', reason: 'word_order' };
  return { result: 'different', reason: 'different_name' };
}

/** Localities: same normalisation, spaces ignored (M02-FR-09). */
export function sameLocality(a: string, b: string): boolean {
  return normaliseName(a).join('') === normaliseName(b).join('');
}
