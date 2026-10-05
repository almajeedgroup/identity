/** M17-FR-03 · sniff → text → Aadhaar guard → detect → extract. The caller stores the result only if accepted. */
import type { DocumentKind, KnowledgeBase } from '@identity/content';
import { extractFields } from './extract';
import { containsFullAadhaar } from './guard';
import type { Extraction, OcrProvider, OcrResult } from './types';

export type UploadMime = 'image/jpeg' | 'image/png' | 'application/pdf';

export type PipelineResult =
  | { status: 'rejected_aadhaar' }
  | { status: 'no_text'; ocr: OcrResult }
  | { status: 'ok'; ocr: OcrResult; extraction: Extraction; detectedKind: DocumentKind | null; kindMismatch: boolean };

export interface Providers {
  image: OcrProvider;
  pdf: OcrProvider;
}

export async function readDocument(bytes: Uint8Array, mime: UploadMime, chosenKind: DocumentKind, providers: Providers, kb?: KnowledgeBase): Promise<PipelineResult> {
  const ocr = await (mime === 'application/pdf' ? providers.pdf : providers.image).recognise(bytes);
  if (containsFullAadhaar(ocr.text)) return { status: 'rejected_aadhaar' };
  if (ocr.text.replace(/\s+/g, '').length < 8) return { status: 'no_text', ocr };
  const { detectedKind, ...extraction } = extractFields(ocr.text, { kind: chosenKind, words: ocr.words, defaultConfidence: ocr.meanConfidence, ...(kb ? { kb } : {}) });
  return { status: 'ok', ocr, extraction, detectedKind, kindMismatch: detectedKind !== null && detectedKind !== chosenKind };
}
