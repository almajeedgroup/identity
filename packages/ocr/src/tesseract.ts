/** ADR-012 · Local Tesseract OCR with bundled English data — no document leaves our servers. */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { OcrProvider, OcrResult, OcrWord } from './types';

/**
 * Resolved at run time from the working directory: bundlers rewrite `require.resolve` into module ids, and the
 * language data must be read from disk (node_modules), not bundled.
 */
const runtimeRequire = () => createRequire(join(process.cwd(), 'package.json'));

interface TesseractWord {
  text: string;
  confidence: number;
}
interface TesseractBlock {
  paragraphs: { lines: { words: TesseractWord[] }[] }[];
}

export class TesseractProvider implements OcrProvider {
  readonly name = 'tesseract';
  private worker: Promise<import('tesseract.js').Worker> | null = null;

  private getWorker() {
    this.worker ??= (async () => {
      const { createWorker } = await import('tesseract.js');
      const langPath = process.env.OCR_LANG_PATH ?? join(dirname(runtimeRequire().resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int');
      return createWorker('eng', 1, { langPath, cacheMethod: 'none', gzip: true });
    })();
    return this.worker;
  }

  async recognise(bytes: Uint8Array): Promise<OcrResult> {
    const worker = await this.getWorker();
    const { data } = await worker.recognize(Buffer.from(bytes), {}, { text: true, blocks: true });
    const blocks = (data as unknown as { blocks: TesseractBlock[] | null }).blocks ?? [];
    const words: OcrWord[] = blocks.flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words.map((w) => ({ text: w.text, confidence: w.confidence / 100 })))));
    const meanConfidence = words.length ? words.reduce((s, w) => s + w.confidence, 0) / words.length : 0;
    const version = (runtimeRequire()('tesseract.js/package.json') as { version: string }).version;
    return { text: data.text, words, meanConfidence, provider: this.name, engineVersion: `tesseract.js ${version} / eng 4.0.0_best_int` };
  }

  async close() {
    if (this.worker) await (await this.worker).terminate();
    this.worker = null;
  }
}
