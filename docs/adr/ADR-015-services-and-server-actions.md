# ADR-015 · Application services in their own package; Next.js server actions without client-side state

**Status:** Accepted (provisional) · **Date:** 2026-10-05 · **Specs:** M16, M17, F06, F05

## Context
The Full Check (PRD P0) writes personal data: consents, profiles, documents, uploads, targets and overrides. Every write must check consent (F06-FR-02) and ownership, write an audit event (M15), and be testable without a browser. The citizen app must work on budget phones and poor connections (F09), and must not keep personal data in the browser (C-03, C-04).

## Decision
- **`packages/services`** holds every operation on citizen data (`addTypedDocument`, `uploadDocument`, `confirmDocument`, `editDocument`, `deleteDocument`, `confirmTarget`, `setOverride`, `runFullCheck`, `withdrawUploads`, `withdrawFullCheck`, `closeAccount` …). Each one checks consent and ownership on the server, refuses with a typed `ServiceError` code, and writes its audit event. They run against PGlite in unit tests and against PostgreSQL in CI.
- **The web app is a thin layer**: server components read through the services; **server actions** (plain HTML forms) call them and redirect, with `?error=<code>` turned into a translated message. Pages work without client-side JavaScript; the only client components are the language switcher, large-text toggle and a submit button that prevents double submission.
- **One platform per server process** (`apps/web/lib/server/platform.ts`): configuration, migrated and seeded database, encrypted store, code sender, OCR providers and a 30-second knowledge-base cache, kept on `globalThis`. Hourly housekeeping purges uploads past retention and old sign-in codes.
- **Packages that load WebAssembly, workers or data files** (`@electric-sql/pglite`, `pg`, `tesseract.js`, `pdfjs-dist`) stay outside the bundle (`serverExternalPackages`), and the OCR language data is resolved at run time, never through bundler-rewritten `require.resolve`.

## Consequences
- Business rules are unit-tested without HTTP; the acceptance tests cover the screens.
- No API surface to secure beyond server actions and two route handlers (`/api/files/<id>`, development-only `/api/dev/outbox`).
- Background work runs in the web process for now; a separate worker comes with ADR-007 (jobs) when SLA timers and reminders arrive (P1).
