# ADR-002 · Rules engine runs in the browser

**Status:** Accepted (provisional) · **Date:** 2026-10-04 · **Specs:** M01, M02, F02

## Context
The Health Check "runs in the citizen's browser — nothing is stored unless they choose to open a case" (DPR §06, constitution C-04). The same rules must later validate data on the server when a case is opened.

## Decision
The Mismatch Detector, health score and action-plan logic live in `packages/rules` as **pure, deterministic TypeScript functions** with no I/O. They take the citizen's answers and a content bundle (`packages/content`) and return a report. The browser imports them directly; the server can import the same code.

## Consequences
- Privacy by construction: the check needs no API.
- Executable examples in the specs can test the engine directly and fast.
- The content bundle is shipped to the browser, so it must contain no personal data (it does not).
