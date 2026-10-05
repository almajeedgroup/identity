/** M17-AC-3.2 · ICAO 9303 TD3 (passport) machine-readable zone. */
const value = (c: string) => (c === '<' ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55);

export function checkDigit(s: string): string {
  const weights = [7, 3, 1];
  return String([...s].reduce((sum, c, i) => sum + value(c) * weights[i % 3]!, 0) % 10);
}

export interface Mrz {
  number: string;
  surname: string;
  givenNames: string;
  name: string;
  /** YYYY-MM-DD */
  dob: string;
  gender: 'M' | 'F' | 'X';
  checksOk: boolean;
}

/** Finds the two 44-character TD3 lines in OCR text (spaces removed). */
export function findMrzLines(text: string): [string, string] | null {
  const lines = text.split('\n').map((l) => l.replace(/\s+/g, '').toUpperCase());
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^P[A-Z<][A-Z<]{3}[A-Z<]{39}$/.test(lines[i]!) && /^[A-Z0-9<]{44}$/.test(lines[i + 1]!)) return [lines[i]!, lines[i + 1]!];
  }
  return null;
}

/** Two-digit years: born in the future is impossible, so pick the century that makes the date past. */
function fullYear(yy: number, now = new Date()): number {
  const century = Math.floor(now.getUTCFullYear() / 100) * 100;
  return century + yy > now.getUTCFullYear() ? century - 100 + yy : century + yy;
}

export function parseMrz([l1, l2]: [string, string], now = new Date()): Mrz | null {
  if (l1.length !== 44 || l2.length !== 44 || l1[0] !== 'P') return null;
  const names = l1.slice(5).replace(/<+$/, '');
  const [surnamePart, givenPart = ''] = names.split('<<');
  const surname = surnamePart!.replace(/</g, ' ').trim();
  const givenNames = givenPart.replace(/</g, ' ').trim();
  const number = l2.slice(0, 9).replace(/</g, '');
  const dob = l2.slice(13, 19);
  const sex = l2[20]!;
  const checks = [
    checkDigit(l2.slice(0, 9)) === l2[9],
    checkDigit(dob) === l2[19],
    checkDigit(l2.slice(21, 27)) === l2[27],
    checkDigit(l2.slice(28, 42)) === l2[42] || (l2.slice(28, 43) === '<'.repeat(15)),
    checkDigit(l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43)) === l2[43],
  ];
  if (!/^\d{6}$/.test(dob)) return null;
  const year = fullYear(Number(dob.slice(0, 2)), now);
  return {
    number,
    surname,
    givenNames,
    name: [givenNames, surname].filter(Boolean).join(' '),
    dob: `${year}-${dob.slice(2, 4)}-${dob.slice(4, 6)}`,
    gender: sex === 'M' || sex === 'F' ? sex : 'X',
    checksOk: checks.every(Boolean),
  };
}
