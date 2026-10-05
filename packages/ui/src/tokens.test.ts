import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadExample, repoRoot } from '../../../tools/spec/specs';
import { colors, contrastRatio, severity, status, type ColorToken } from './tokens';

describe('F03 design tokens', () => {
  const ex = loadExample<{
    minimum: number;
    pairs: { text: ColorToken; background: ColorToken }[];
    failing_dpr_text_uses: { text: ColorToken; background: ColorToken }[];
  }>('F03', 'F03-EX-contrast');

  it.each(ex.pairs)('@F03-AC-1.1 F03-EX-contrast $text on $background meets AA', ({ text, background }) => {
    expect(contrastRatio(colors[text], colors[background])).toBeGreaterThanOrEqual(ex.minimum);
  });

  it.each(ex.failing_dpr_text_uses)('F03-EX-contrast $text on $background fails as body text (why F03-FR-02 exists)', ({ text, background }) => {
    expect(contrastRatio(colors[text], colors[background])).toBeLessThan(ex.minimum);
  });

  it('@F03-AC-1.1 every status uses a text colour that passes AA on its tint and on the app background', () => {
    for (const s of Object.values(status)) {
      expect(contrastRatio(colors[s.text], colors[s.tint])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors[s.text], colors.mist50)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the app stylesheet declares exactly these token values', () => {
    const css = readFileSync(join(repoRoot, 'apps/web/app/globals.css'), 'utf8');
    for (const [name, hex] of Object.entries(colors)) {
      const cssName = name.replace(/(\d+)$/, '-$1');
      expect(css, `--color-${cssName}`).toMatch(new RegExp(`--color-${cssName}:\\s*${hex};`, 'i'));
    }
  });

  it('@F03-AC-5.1 F03-EX-severity — each of the six statuses has its colour family, icon and an AA text/tint pair', () => {
    const ex = loadExample<{ minimum: number; statuses: Record<string, { colour: string; text: ColorToken; tint: ColorToken; icon: string }> }>('F03', 'F03-EX-severity');
    expect(severity).toEqual(ex.statuses);
    for (const [name, s] of Object.entries(ex.statuses)) {
      expect(contrastRatio(colors[s.text], colors[s.tint]), name).toBeGreaterThanOrEqual(ex.minimum);
      expect(contrastRatio(colors[s.text], colors.white), name).toBeGreaterThanOrEqual(ex.minimum);
    }
  });
});
