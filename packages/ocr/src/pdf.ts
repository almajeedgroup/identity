/** M17-AC-4.1 · Read the text layer of a PDF; scanned PDFs have none. */
import type { OcrProvider, OcrResult } from './types';

export class PdfTextProvider implements OcrProvider {
  readonly name = 'pdf-text';

  async recognise(bytes: Uint8Array): Promise<OcrResult> {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({ data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: false });
    const doc = await task.promise;
    let text = '';
    for (let i = 1; i <= Math.min(doc.numPages, 4); i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      for (const item of content.items as { str?: string; hasEOL?: boolean }[]) text += (item.str ?? '') + (item.hasEOL ? '\n' : '');
      text += '\n';
    }
    await task.destroy();
    const words = text.split(/\s+/).filter(Boolean).map((w) => ({ text: w, confidence: 1 }));
    return { text: text.trim(), words, meanConfidence: words.length ? 1 : 0, provider: this.name, engineVersion: `pdfjs-dist ${pdfjs.version}` };
  }
}
