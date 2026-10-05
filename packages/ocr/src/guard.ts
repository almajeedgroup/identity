/** M17-AC-2.3 / C-03 · Never keep an upload that shows a full Aadhaar number. */
import { findAadhaarNumbers } from '@identity/rules';

export function containsFullAadhaar(text: string): boolean {
  // OCR sometimes merges the groups; look at digit runs with and without separators.
  return findAadhaarNumbers(text).length > 0 || findAadhaarNumbers(text.replace(/(\d)[ -](?=\d)/g, '$1')).length > 0;
}
