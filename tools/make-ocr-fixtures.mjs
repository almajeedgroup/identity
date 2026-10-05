/**
 * Generates synthetic OCR fixtures (fictitious people, no real document design) for M17 tests.
 * Run: node tools/make-ocr-fixtures.mjs   (needs Playwright's Chromium; set PW_CHROMIUM_PATH if pre-installed)
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), 'tests/fixtures/ocr');
mkdirSync(out, { recursive: true });
const SPECIMEN = 'SPECIMEN - NOT A REAL DOCUMENT - TEST FIXTURE';
const card = (lines) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;background:#fff;color:#111;padding:28px;width:760px">` +
  lines.map(([text, size = 22, weight = 400]) => `<div style="font-size:${size}px;font-weight:${weight};margin:6px 0">${text}</div>`).join('') +
  `<div style="font-size:13px;margin-top:14px">${SPECIMEN}</div></div>`;

const fixtures = {
  'pan.png': card([['INCOME TAX DEPARTMENT GOVT. OF INDIA', 22, 700], ['Permanent Account Number Card', 16], ['ABCPE1234F', 26, 700], ['Name', 14], ['MOHAMMED IBRAHIM'], ["Father's Name", 14], ['ABDUL RAHEEM'], ['Date of Birth', 14], ['12/04/2002']]),
  'aadhaar-masked.png': card([['Government of India', 20, 700], ['Unique Identification Authority of India', 18], ['Mohammed Ibrahim', 24], ['DOB: 12/04/2002'], ['Male'], ['XXXX XXXX 2346', 28, 700]]),
  // Uses the published checksum test number 2341 2341 2346 (F12-EX-verhoeff), never a real one.
  'aadhaar-unmasked.png': card([['Government of India', 20, 700], ['Unique Identification Authority of India', 18], ['Mohammed Ibrahim', 24], ['DOB: 12/04/2002'], ['Male'], ['2341 2341 2346', 28, 700]]),
  'voter.png': card([['ELECTION COMMISSION OF INDIA', 22, 700], ['IDENTITY CARD', 16], ['XYZ1234567', 24, 700], ["Elector's Name : Mohammed Ibrahim"], ["Father's Name : Abdul Raheem"], ['Sex : Male'], ['Date of Birth : 12-04-2002']]),
};

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 820, height: 600 }, deviceScaleFactor: 1 });
for (const [name, html] of Object.entries(fixtures)) {
  await page.setContent(`<body style="margin:0;background:#fff">${html}</body>`);
  await page.locator('body > div').screenshot({ path: join(out, name) });
}
await page.setContent(`<body style="margin:0">${fixtures['pan.png']}</body>`);
await page.pdf({ path: join(out, 'pan-text.pdf'), width: '840px', height: '520px' });
// A "scanned" PDF: the card as an image only, no text layer.
const png = (await page.locator('body > div').screenshot()).toString('base64');
await page.setContent(`<body style="margin:0"><img src="data:image/png;base64,${png}" style="width:780px"></body>`);
await page.pdf({ path: join(out, 'scanned.pdf'), width: '840px', height: '520px' });
await browser.close();
console.log('OCR fixtures written to', out);
