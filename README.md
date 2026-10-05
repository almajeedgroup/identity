# 1dentity

A citizen document-care platform from **1dentity, a unit of Islamic Information Centre (IIC), Bengaluru**. It helps people keep their Aadhaar, PAN, Voter ID, passport, certificates and other essential documents valid, consistent and correct: a quick check on the phone, a full comparison of every document, and a step-by-step correction plan that leads to the official offices — backed by 1dentity's help desk and community camps.

*Valid. Correct. Yours.*

1dentity is not a government office and never changes government records; government fees are paid only to the issuing authority.

## Where things are

| Path | What it is |
|---|---|
| [`Identity_WebApp_DPR_v1.0.pdf`](./Identity_WebApp_DPR_v1.0.pdf) | Detailed Project Report v1.0 — the business case, scope, design language, architecture and roadmap |
| [`docs/prd-reconciliation.md`](./docs/prd-reconciliation.md) | How the Developer PRD (confidential, not stored here) and the DPR were reconciled |
| [`docs/sdd-plan.md`](./docs/sdd-plan.md) | **Spec-driven development plan**; §7.7 is the current build sequence |
| [`specs/constitution.md`](./specs/constitution.md) | Non-negotiable principles every spec and plan must satisfy |
| [`specs/README.md`](./specs/README.md) | Spec register — every spec, its phase, owner and status |
| [`specs/open-questions.md`](./specs/open-questions.md) | Decisions and clarifications that block or shape specs |
| [`docs/adr/`](./docs/adr/) | Architecture decision records |
| [`docs/traceability.md`](./docs/traceability.md) | Generated report: every acceptance criterion and the tests that cover it |
| `apps/web` | Next.js app — Quick Check, Full Check, privacy notice, staff console (`/staff`) |
| `packages/services` | Full Check operations on citizen data: consent, profile, targets, documents, reports, deletion (ADR-015) |
| `packages/engine` | M02/M16/M18 comparison, target suggestions and correction roadmap — pure functions |
| `packages/ocr` | M17 OCR pipeline: Tesseract and PDF text, Aadhaar guard, field extraction, passport MRZ |
| `packages/db` | F01/F05/F07/M15 database schema and migrations, encryption, sessions, one-time codes, audit log, storage |
| `packages/content` | F02 content model and rules knowledge base (seed) |
| `packages/rules` | Quick Check (M01, M02 Part A) — runs in the browser |
| `packages/domain`, `packages/ui` | F01 case lifecycle; F03 design tokens |
| `tools/` | Spec loader, traceability, i18n, content and Aadhaar-number checks; OCR fixture generator |
| `tests/acceptance` | Playwright acceptance tests, tagged with spec IDs |

## Status — increment 6d (October 2026): the PRD's P0 and P1 scope

Built and tested, in English, Kannada, Hindi and Urdu (right to left):

1. **Quick Check** — anonymous, on the phone; nothing leaves the device.
2. **Full Check** — sign in with a one-time code; agree per purpose; add documents by typing or by uploading a photo or PDF that is read on our own servers (never a full Aadhaar number); confirm what was read; compare every field across documents with six statuses; choose target details; dispute a result; follow a dependency-ordered correction plan with official sources, government fees and the separate 1dentity service fee; withdraw or delete everything.
3. **Assistance cases** — from any correction step a citizen can ask 1dentity for help (separate consent; the 1dentity fee shown apart from the government fee); staff see a masked queue ordered by priority and SLA, claim or assign cases, open the citizen's documents only for their own cases, work a checklist, write notes, record the authority's reference and close with proof; the citizen follows the case and replies.
4. **Notifications** — every case change and upload appears in the citizen's notification list; citizens who opt in also get an SMS with only the case ID and a link to 1dentity (held at night, retried on failure).
5. **Service fees** — 1dentity's fee for assistance is agreed by the citizen before anything is charged, paid at the help desk with a numbered receipt that says it is not a government fee; supervisors waive or refund with a reason and see revenue. Government fees are never collected.
6. **Family profiles** — up to 8 family members under one account, added with a recorded declaration (their permission, or parent or guardian of a child); each has their own documents, report, plan and help requests, and every screen says whose documents they are. Differences in a parent's or spouse's name between family members' documents are shown as information, never as a judgement on the relationship.
7. **Staff console** (`/staff`, English) — sign-in with an authenticator app, a dashboard of counts, a customer list that shows no personal data until a citizen asks for help, a rules admin where every change is a version that a publisher publishes (a second person for fees and links), verification against official sources, service prices, a filtered audit log with hash-chain check, and team management.

Before a public release:

- Specs are *In review*: approvers are not yet appointed (DEC-2 in [`open-questions.md`](./specs/open-questions.md)).
- Kannada, Hindi and Urdu texts are **drafts** awaiting language reviewers ([`apps/web/messages/STATUS.md`](./apps/web/messages/STATUS.md)).
- Correction rules, fees, forms and links are **not yet verified** on the official portals; the app says so on every step.
- The privacy notice is a draft for legal review; the SMS provider (ADR-005) and production object store (ADR-004) are open.

What stands between this build and a launch: [`docs/launch-readiness.md`](./docs/launch-readiness.md).

## Running it

Requires Node.js 22.

```bash
npm install
npm run dev          # http://localhost:3000
```

Without configuration the app uses an embedded PostgreSQL (PGlite) and an encrypted file store under `apps/web/.data/`, generates development keys there, and writes sign-in codes to a development outbox: after asking for a code, open `/api/dev/outbox?mobile=<number>` to read it. Useful settings:

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL instead of PGlite |
| `PGLITE_DIR`, `STORAGE_DIR` | Where PGlite and files live; `memory://` keeps them in memory |
| `DATA_KEYS`, `DATA_KEY_CURRENT`, `OTP_PEPPER` | Encryption keys and code pepper — required when `APP_ENV=production` |
| `APP_ENV` | `development` (default), `test`, `staging` or `production`; production refuses development defaults |
| `APP_URL` | Public URL; `https://` turns on `Secure` cookies |
| `SMS_QUIET_HOURS` | `off` disables the 21:00–08:00 hold (tests only; production always holds) |
| `CASE_HOLIDAYS` | Holidays excluded from case SLA counting, e.g. `2026-10-20,2026-11-01` |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Development and tests only: a first admin for `/staff` (ignored in production — use `STAFF_PASSWORD=… npm run staff:create -- --email … --name … --roles admin`) |

Quality gates (the same as CI):

```bash
npm run typecheck
npm test             # unit tests; executable examples are read straight from specs/*/spec.md
                     # TEST_DATABASE_URL=postgres://… also runs the database tests on PostgreSQL
npm run check:i18n   # every language has every message
npm run check:aadhaar
npm run check:content
npm run trace        # writes docs/traceability.md
npm run build
npm run test:e2e     # Playwright; set PW_CHROMIUM_PATH to use a pre-installed Chromium
```

## How work happens here

No behaviour is built without a spec. Each change goes **Specify → Clarify → Plan → Tasks → Implement → Verify**, with three gates (spec ready, plan ready, done). A pull request that changes behaviour updates the spec in the same pull request. Details are in [`docs/sdd-plan.md`](./docs/sdd-plan.md) §5.
