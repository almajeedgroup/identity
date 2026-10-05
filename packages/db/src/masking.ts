/** M15-AC-2.1 · Masking of document numbers in views (C-03 for Aadhaar). */
export function maskNumber(value: string): string {
  const compact = value.replace(/\s+/g, '');
  if (compact.length <= 4) return compact;
  return '•'.repeat(compact.length - 4) + compact.slice(-4);
}

export function maskAadhaar(last4: string): string {
  return `XXXX XXXX ${last4}`;
}
