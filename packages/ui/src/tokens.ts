/** F03 · Urbanist UI tokens. DPR §07 palette plus the F03-FR-02 contrast-fix text colours. */

export const colors = {
  // DPR §07 palette (F03-FR-01)
  ink900: '#0F1B2D',
  emerald600: '#0E7C66',
  mint300: '#6EE7C8',
  emerald50: '#E7F5F1',
  mist50: '#F5F7F6',
  amber400: '#F5A524',
  coral500: '#E5484D',
  sky500: '#2F6FED',
  slate500: '#5B6B7A',
  line200: '#DCE3E1',
  white: '#FFFFFF',
  // F03-FR-02 text colours and status tints
  emerald700: '#0B6B58',
  amber700: '#9A5800',
  coral700: '#B9282E',
  sky600: '#1F5BD6',
  amber50: '#FEF3DC',
  coral50: '#FDECEC',
  sky50: '#EAF1FE',
  // F03-FR-08 severity tokens (PRD §12)
  yellow700: '#7A5C00',
  yellow50: '#FFF8D6',
  orange700: '#A84300',
  orange50: '#FFEEDF',
  slate50: '#EEF1F3',
} as const;

export type ColorToken = keyof typeof colors;

export const status = {
  valid: { text: 'emerald700', tint: 'emerald50' },
  update_due: { text: 'amber700', tint: 'amber50' },
  mismatch: { text: 'coral700', tint: 'coral50' },
  in_progress: { text: 'sky600', tint: 'sky50' },
} as const satisfies Record<string, { text: ColorToken; tint: ColorToken }>;

export type StatusKind = keyof typeof status;

/** F03-FR-08 · The six Full Check statuses (M02-FR-14). */
export const severity = {
  exact_match: { colour: 'green', text: 'emerald700', tint: 'emerald50', icon: 'check' },
  formatting_variation: { colour: 'green', text: 'emerald700', tint: 'emerald50', icon: 'check' },
  likely_equivalent: { colour: 'yellow', text: 'yellow700', tint: 'yellow50', icon: 'approx' },
  potential_discrepancy: { colour: 'orange', text: 'orange700', tint: 'orange50', icon: 'warning' },
  major_discrepancy: { colour: 'red', text: 'coral700', tint: 'coral50', icon: 'cross' },
  missing: { colour: 'grey', text: 'slate500', tint: 'slate50', icon: 'dash' },
} as const satisfies Record<string, { colour: string; text: ColorToken; tint: ColorToken; icon: string }>;

/** F03-FR-03 type scale: [size px, weight]. */
export const type = {
  display: [32, 800],
  heading: [22, 700],
  body: [16, 500],
  caption: [13, 600],
} as const;

export const touchTargetPx = 48;
export const largeTextScale = 1.25;

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`Not a #RRGGBB colour: ${hex}`);
  const [r, g, b] = [m[1]!, m[2]!, m[3]!].map((h) => channel(parseInt(h, 16))) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
