# Architecture decision records

One file per decision. Status: Proposed → Accepted → Superseded. A new runtime, datastore or third-party service needs an ADR (constitution C-15).

| ADR | Decision | Status |
|---|---|---|
| [ADR-001](./ADR-001-single-codebase.md) | One Next.js + TypeScript codebase for citizen, console and admin surfaces | Accepted (provisional) |
| [ADR-002](./ADR-002-rules-engine-in-browser.md) | Rules engine as a pure TypeScript package that runs in the browser | Accepted (provisional) |
| ADR-003 | Content Manager: build in-app or adopt a headless CMS | Open — before M13 |
| ADR-004 | India-region cloud provider, managed PostgreSQL, storage, backups | Open — Phase 0 week 2 |
| ADR-005 | Citizen login code channel (SMS via DLT or WhatsApp) | Open — before F05 |
| [ADR-006](./ADR-006-i18n.md) | Small in-house i18n layer instead of a library | Accepted (provisional) |
| ADR-007 | Background jobs and scheduling | Open — before S3 |
| ADR-008 | Privacy-friendly analytics and error tracking | Open — before F11 |
| ADR-009 | WhatsApp Business Platform provider | Open — Phase 0 week 4 |
| [ADR-010](./ADR-010-monorepo-and-testing.md) | npm-workspaces monorepo; Vitest and Playwright; specs as test fixtures | Accepted (provisional) |

"Provisional" means accepted by the build team ahead of the product owner's appointment (DEC-2); to be confirmed at the first stage gate.
