/** F12 / C-03 · Detect and mask Aadhaar-like numbers (12 digits, first digit 2–9, Verhoeff checksum). */

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 7, 6, 0, 8],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let c = 0;
  const reversed = digits.split('').reverse();
  for (let i = 0; i < reversed.length; i++) c = D[c]![P[i % 8]![+reversed[i]!]!]!;
  return c === 0;
}

export function isAadhaarLike(digits: string): boolean {
  return /^[2-9]\d{11}$/.test(digits) && verhoeffValid(digits);
}

const CANDIDATE = /(?<!\d)([2-9]\d{3})([ -]?)(\d{4})\2(\d{4})(?!\d)/g;

export interface AadhaarMatch {
  index: number;
  text: string;
}

export function findAadhaarNumbers(text: string): AadhaarMatch[] {
  return [...text.matchAll(CANDIDATE)]
    .filter((m) => isAadhaarLike(`${m[1]}${m[3]}${m[4]}`))
    .map((m) => ({ index: m.index!, text: m[0] }));
}

/** Replace all but the last four digits with X, keeping separators. */
export function maskAadhaarNumbers(text: string): string {
  return text.replace(CANDIDATE, (whole, a: string, sep: string, b: string, c: string) =>
    isAadhaarLike(`${a}${b}${c}`) ? `XXXX${sep}XXXX${sep}${c}` : whole,
  );
}
