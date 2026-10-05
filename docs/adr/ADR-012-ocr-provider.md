# ADR-012 · OCR behind a provider interface; local Tesseract first

**Status:** Accepted (provisional) · **Date:** 2026-10-05 · **Specs:** M17 · **Question:** Q-28

## Context
PRD §10 and §24 require OCR with "replaceable provider architecture" and never silently trusting OCR. Citizens' identity documents are highly sensitive (PRD §23); sending images to a third-party AI service needs a data-processing agreement, India-region processing and a legal review.

## Decision
- An `OcrProvider` interface returns text, words with confidence and the engine version. Field extraction (mapping text to document fields) is separate, deterministic and tested.
- The first provider is **Tesseract** (tesseract.js, WebAssembly) running **on our own servers** with bundled language data (English now; Kannada data is available for later phases). No document leaves our infrastructure.
- PDFs with a text layer are read directly; scanned PDFs ask for a photo or manual entry until a renderer is added.
- A cloud document-AI provider may be added later only with an ADR, a data-processing agreement and India-region processing.

## Consequences
- Works offline; about 0.7 s per card image on one CPU core in testing.
- Accuracy on worn or photographed cards is lower than commercial document AI — mitigated by mandatory citizen confirmation (C-17) and per-field confidence.
