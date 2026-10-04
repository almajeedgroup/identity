# Identity Web App

A citizen document-care platform from **Identity, a unit of Islamic Information Centre (IIC), Bengaluru**. It helps people keep their Aadhaar, PAN, Voter ID and other essential documents valid, consistent and correct — through a Document Health Check, a Mismatch Detector, step-by-step guides, appointment booking and case tracking, backed by Identity's help desk and community camps.

*Valid. Correct. Yours.*

## Where things are

| Path | What it is |
|---|---|
| [`Identity_WebApp_DPR_v1.0.pdf`](./Identity_WebApp_DPR_v1.0.pdf) | Detailed Project Report v1.0 — the business case, scope, design language, architecture and roadmap |
| [`docs/sdd-plan.md`](./docs/sdd-plan.md) | **Spec-driven development plan** — how the DPR becomes specs, tests and code |
| [`specs/constitution.md`](./specs/constitution.md) | Non-negotiable principles every spec and plan must satisfy |
| [`specs/README.md`](./specs/README.md) | Spec register — every spec, its phase, owner and status |
| [`specs/backlog.md`](./specs/backlog.md) | Seeded requirements and acceptance scenarios for specs not yet written in full |
| [`specs/open-questions.md`](./specs/open-questions.md) | Decisions and clarifications that block or shape specs |
| [`docs/adr/`](./docs/adr/) | Architecture decision records |
| [`docs/traceability.md`](./docs/traceability.md) | Generated report: every acceptance criterion and the tests that cover it |
| `apps/web` | Next.js app — citizen surface (console and admin come with F05/M15) |
| `packages/domain` | F01 case lifecycle |
| `packages/content` | F02 content model, official-link allowlist, seed content for Aadhaar, PAN, Voter ID |
| `packages/rules` | M02 Mismatch Detector and M01 health score — pure functions that run in the browser |
| `packages/ui` | F03 design tokens |
| `tools/` | Spec loader, traceability, i18n, content and Aadhaar-number checks |
| `tests/acceptance` | Playwright acceptance tests, tagged with spec IDs |

## Status — increment 1 (October 2026)

Built and tested: the **Document Health Check** (M01) and **Mismatch Detector** (M02) for Aadhaar, PAN and Voter ID, in English, Kannada, Hindi and Urdu (right to left), running entirely on the citizen's phone, plus the foundations they need (F01–F04, F12).

Before a public release:

- Specs are *In review*: approvers are not yet appointed (DEC-2 in [`open-questions.md`](./specs/open-questions.md)).
- Kannada, Hindi and Urdu texts are **drafts** awaiting language reviewers ([`apps/web/messages/STATUS.md`](./apps/web/messages/STATUS.md)).
- Fees, forms and links come from the DPR and are **not yet verified** on the official portals; the app says so on every step.

Next, per the plan: F05 authentication, M15 access and audit, M13 Content Manager (waiting on ADR-003 to ADR-005), then M03 Smart Guides and M08 Hub.

## Running it

Requires Node.js 22.

```bash
npm install
npm run dev          # http://localhost:3000
```

Quality gates (the same as CI):

```bash
npm run typecheck
npm test             # unit tests; executable examples are read straight from specs/*/spec.md
npm run check:i18n   # every language has every message
npm run check:aadhaar
npm run check:content
npm run trace        # writes docs/traceability.md
npm run build
npm run test:e2e     # Playwright; set PW_CHROMIUM_PATH to use a pre-installed Chromium
```

## How work happens here

No behaviour is built without a spec. Each change goes **Specify → Clarify → Plan → Tasks → Implement → Verify**, with three gates (spec ready, plan ready, done). A pull request that changes behaviour updates the spec in the same pull request. Details are in [`docs/sdd-plan.md`](./docs/sdd-plan.md) §5.
