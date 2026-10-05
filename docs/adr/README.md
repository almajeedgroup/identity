# Architecture decision records

One file per decision. Status: Proposed → Accepted → Superseded. A new runtime, datastore or third-party service needs an ADR (constitution C-15).

| ADR | Decision | Status |
|---|---|---|
| [ADR-001](./ADR-001-single-codebase.md) | One Next.js + TypeScript codebase for citizen, console and admin surfaces | Accepted (provisional) |
| [ADR-002](./ADR-002-rules-engine-in-browser.md) | Rules engine as a pure TypeScript package that runs in the browser | Accepted (provisional) |
| ADR-003 | Content Manager: build in-app or adopt a headless CMS | Open for guides and explainers (P1); the rules database is built in-app (M13 v0.2) |
| ADR-004 | India-region cloud provider, managed PostgreSQL, storage, backups | Open — Phase 0 week 2 |
| ADR-005 | Citizen login code channel (SMS via DLT or WhatsApp) | Open — before F05 |
| [ADR-006](./ADR-006-i18n.md) | Small in-house i18n layer instead of a library | Accepted (provisional) |
| ADR-007 | Background jobs and scheduling | Open — before S3 |
| ADR-008 | Privacy-friendly analytics and error tracking | Open — before F11 |
| ADR-009 | WhatsApp Business Platform provider | Open — Phase 0 week 4 |
| [ADR-010](./ADR-010-monorepo-and-testing.md) | npm-workspaces monorepo; Vitest and Playwright; specs as test fixtures | Accepted (provisional) |
| [ADR-011](./ADR-011-drizzle-postgres.md) | Drizzle ORM on PostgreSQL; embedded PGlite for development and tests | Accepted (provisional) |
| [ADR-012](./ADR-012-ocr-provider.md) | OCR behind a provider interface; local Tesseract first | Accepted (provisional) |
| [ADR-013](./ADR-013-application-encryption.md) | Application-level AES-256-GCM for sensitive values and files | Accepted (provisional) |
| [ADR-014](./ADR-014-sessions-and-codes.md) | Server-side sessions; staff TOTP; one-time codes through a sender interface | Accepted (provisional) |
| ADR-016 | Online payment provider for service fees (checkout, webhooks, refunds) | Open — before online payments (M19) |
| [ADR-015](./ADR-015-services-and-server-actions.md) | Application services package; server actions with plain forms; one platform per process | Accepted (provisional) |

"Provisional" means accepted by the build team ahead of the product owner's appointment (DEC-2); to be confirmed at the first stage gate.
