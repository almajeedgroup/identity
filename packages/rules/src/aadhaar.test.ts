import { describe, expect, it } from 'vitest';
import { loadExample } from '../../../tools/spec/specs';
import { findAadhaarNumbers, isAadhaarLike, maskAadhaarNumbers } from './aadhaar';
import { parseDob } from './dob';

describe('F12 Aadhaar-number guard (C-03)', () => {
  it('@F12-AC-2.1 F12-EX-verhoeff', () => {
    const ex = loadExample<{ valid: string[]; invalid: string[] }>('F12', 'F12-EX-verhoeff');
    for (const v of ex.valid) expect(isAadhaarLike(v), v).toBe(true);
    for (const v of ex.invalid) expect(isAadhaarLike(v), v).toBe(false);
    expect(findAadhaarNumbers(`a ${ex.valid[0]} b ${ex.invalid[0]}`)).toHaveLength(1);
  });

  it('@F12-AC-2.2 F12-EX-masking', () => {
    const ex = loadExample<{ cases: { text: string; expect: string }[] }>('F12', 'F12-EX-masking');
    for (const c of ex.cases) expect(maskAadhaarNumbers(c.text)).toBe(c.expect);
  });
});

describe('date-of-birth parsing', () => {
  it('accepts DD-MM-YYYY and year-only, rejects impossible dates', () => {
    expect(parseDob('12-06-1990')).toEqual({ year: 1990, month: 6, day: 12 });
    expect(parseDob('1974')).toEqual({ year: 1974 });
    expect(parseDob('31-02-1990')).toBeUndefined();
    expect(parseDob('1990-06-12')).toBeUndefined();
  });
});
