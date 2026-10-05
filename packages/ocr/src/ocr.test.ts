import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadExample, repoRoot } from '../../../tools/spec/specs';
import { detectKind } from './detect';
import { extractFields } from './extract';
import { containsFullAadhaar } from './guard';
import { findMrzLines, parseMrz } from './mrz';
import { PdfTextProvider } from './pdf';
import { readDocument } from './pipeline';
import { TesseractProvider } from './tesseract';

const fixture = (name: string) => new Uint8Array(readFileSync(join(repoRoot, 'tests/fixtures/ocr', name)));

describe('M17 extraction (pure)', () => {
  const ex = loadExample<{
    cases: { name: string; text: string; expect: { kind: string; number?: string; last4?: string; fields: Record<string, string> } }[];
  }>('M17', 'M17-EX-extraction');

  it.each(ex.cases)('@M17-AC-3.1 M17-EX-extraction $name', (c) => {
    const r = extractFields(c.text);
    expect(r.detectedKind).toBe(c.expect.kind);
    const { relative_type, ...fields } = c.expect.fields;
    expect(Object.fromEntries(Object.entries(r.fields).map(([k, v]) => [k, v!.value]))).toEqual(fields);
    if (relative_type) expect(r.relativeType).toBe(relative_type);
    if (c.expect.number) expect(r.number).toBe(c.expect.number);
    if (c.expect.last4) expect(r.last4).toBe(c.expect.last4);
    for (const v of Object.values(r.fields)) expect(v!.confidence).toBeGreaterThan(0);
  });

  it('@M17-AC-3.2 M17-EX-mrz — passport zone parsed with check digits verified; a bad digit is caught', () => {
    const ex = loadExample<{ lines: [string, string]; expect: Record<string, unknown>; corrupted: [string, string] }>('M17', 'M17-EX-mrz');
    const mrz = parseMrz(findMrzLines(ex.lines.join('\n'))!, new Date('2026-10-05'))!;
    expect(mrz).toEqual(ex.expect);
    expect(parseMrz(ex.corrupted, new Date('2026-10-05'))!.checksOk).toBe(false);
    const fromText = extractFields(`REPUBLIC OF INDIA\nPASSPORT\n${ex.lines.join('\n')}`);
    expect(fromText.detectedKind).toBe('passport');
    expect(fromText.number).toBe('N1234567');
    expect(fromText.fields.name?.value).toBe('MOHAMMED IBRAHIM');
  });

  it('@M17-AC-2.3 M17-EX-aadhaar-guard — full Aadhaar numbers are detected, masked ones are not', () => {
    const ex = loadExample<{ cases: { text: string; rejected: boolean }[] }>('M17', 'M17-EX-aadhaar-guard');
    for (const c of ex.cases) expect(containsFullAadhaar(c.text), c.text).toBe(c.rejected);
  });

  it('@M17-AC-3.5 a document that looks like another type is detected', () => {
    expect(detectKind('ELECTION COMMISSION OF INDIA\nIDENTITY CARD')).toBe('voter_id');
    const r = extractFields('INCOME TAX DEPARTMENT\nName\nRAVI KUMAR', { kind: 'voter_id' });
    expect(r.detectedKind).toBe('pan');
    expect(r.kind).toBe('voter_id');
  });
});

describe('M17 OCR providers (integration)', () => {
  const tesseract = new TesseractProvider();
  const pdf = new PdfTextProvider();
  afterAll(() => tesseract.close());

  it('@M17-AC-2.2 a PAN card photo is read on our own server, with per-field confidence', async () => {
    const r = await readDocument(fixture('pan.png'), 'image/png', 'pan', { image: tesseract, pdf });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.detectedKind).toBe('pan');
    expect(r.extraction.number).toBe('ABCPE1234F');
    expect(r.extraction.fields.name?.value).toBe('MOHAMMED IBRAHIM');
    expect(r.extraction.fields.father_name?.value).toBe('ABDUL RAHEEM');
    expect(r.extraction.fields.dob?.value).toBe('12/04/2002');
    expect(r.ocr.engineVersion).toMatch(/^tesseract\.js /);
    for (const f of Object.values(r.extraction.fields)) expect(f!.confidence).toBeGreaterThan(0.5);
  }, 60_000);

  it('@M17-AC-2.3 an Aadhaar photo showing the full number is rejected; the masked one is read', async () => {
    expect((await readDocument(fixture('aadhaar-unmasked.png'), 'image/png', 'aadhaar', { image: tesseract, pdf })).status).toBe('rejected_aadhaar');
    const masked = await readDocument(fixture('aadhaar-masked.png'), 'image/png', 'aadhaar', { image: tesseract, pdf });
    expect(masked.status).toBe('ok');
    if (masked.status !== 'ok') return;
    expect(masked.extraction.last4).toBe('2346');
    expect(masked.extraction.fields.name?.value).toBe('Mohammed Ibrahim');
    expect(masked.extraction.fields.gender?.value).toBe('Male');
  }, 60_000);

  it('a Voter ID photo maps the father to the relative’s name', async () => {
    const r = await readDocument(fixture('voter.png'), 'image/png', 'voter_id', { image: tesseract, pdf });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.extraction.number).toBe('XYZ1234567');
    expect(r.extraction.fields.relative_name?.value).toBe('Abdul Raheem');
    expect(r.extraction.relativeType).toBe('father');
  }, 60_000);

  it('@M17-AC-4.1 a PDF text layer is read directly; a scanned PDF has no text', async () => {
    const text = await readDocument(fixture('pan-text.pdf'), 'application/pdf', 'pan', { image: tesseract, pdf });
    expect(text.status).toBe('ok');
    if (text.status === 'ok') {
      expect(text.extraction.fields.name?.value).toBe('MOHAMMED IBRAHIM');
      expect(text.ocr.meanConfidence).toBe(1);
    }
    expect((await readDocument(fixture('scanned.pdf'), 'application/pdf', 'pan', { image: tesseract, pdf })).status).toBe('no_text');
  }, 60_000);
});
