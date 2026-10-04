/** npm run check:aadhaar — C-03 / F12-AC-2.1: no real-looking Aadhaar number anywhere in the repository. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findAadhaarNumbers } from '@identity/rules';
import { listTrackedFiles } from './files';
import { repoRoot } from './spec/specs';

/**
 * Published test numbers that pass the checksum and are used on purpose as test vectors (F12-EX-verhoeff).
 * Adding to this list needs the privacy officer's review.
 */
const ALLOWED = new Set(['234123412346', '999941057058']);
const SKIP = /\.(pdf|png|jpe?g|gif|webp|ico|woff2?|ttf|otf)$|package-lock\.json$/;

const findings: string[] = [];
for (const path of listTrackedFiles()) {
  if (SKIP.test(path)) continue;
  let text: string;
  try {
    text = readFileSync(join(repoRoot, path), 'utf8');
  } catch {
    continue;
  }
  for (const match of findAadhaarNumbers(text)) {
    const digits = match.text.replace(/\D/g, '');
    if (ALLOWED.has(digits)) continue;
    const line = text.slice(0, match.index).split('\n').length;
    findings.push(`${path}:${line} contains an Aadhaar-like number`);
  }
}
if (findings.length) {
  console.error(`Aadhaar scan failed (C-03):\n${findings.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('Aadhaar scan passed: no Aadhaar-like numbers outside the documented test vectors.');
