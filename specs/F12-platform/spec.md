# F12 · Platform, environments and delivery

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P1 |
| **Spec owner** | Tech lead |
| **Approvers** | Product owner · QA & security tester |
| **DPR trace** | §08 (stack, hosting, quality), §10 (governance), §11 (team) |
| **Depends on** | ADR-001, ADR-002, ADR-006, ADR-010 (decided); ADR-004 hosting (open) |
| **Version** | 0.2 |

> **Approval note.** This version covers the repository, the quality gates and the development workflow. Hosting, backups and monitoring wait for ADR-004 (India-region provider).

## 1. Summary

A small team must be able to build, test and hand over the system safely. This spec fixes the repository layout, the automated checks every change must pass, and the rules for environments and data.

## 2. Users and scenarios

Developers, QA and the tech lead; indirectly, every citizen whose data the checks protect.

## 3. User stories

### US1 — Every change is checked the same way *(must)*

- **F12-AC-1.1** — *Given* a pull request, *when* CI runs, *then* it runs type checks, unit tests, the i18n check, the Aadhaar-number scan, the traceability report, a production build and the acceptance tests.

### US2 — No full Aadhaar number ever enters the repository *(must)*

- **F12-AC-2.1** — *Given* a text containing a 12-digit number that passes the Aadhaar (Verhoeff) checksum, *when* scanned, *then* it is reported; numbers that fail the checksum are not (`F12-EX-verhoeff`).
- **F12-AC-2.2** — *Given* free text containing such a number, *when* masked, *then* all but the last four digits are replaced (`F12-EX-masking`).

### US3 — Specs and tests stay linked *(must)*

- **F12-AC-3.1** — *Given* specs with acceptance criteria and tests tagged with their IDs, *when* the traceability report runs, *then* it lists each criterion with its tests and flags criteria that have none.
- **F12-AC-3.2** — *Given* a spec whose status is Approved or later, *when* one of its criteria has no test, *then* the traceability check fails; for Draft or In review specs it only reports.

## 4. Functional requirements

- **F12-FR-01** — Monorepo with npm workspaces (ADR-010): `apps/web` (Next.js), `packages/domain`, `packages/rules`, `packages/content`, `packages/ui`, `tools/`, `tests/`.
- **F12-FR-02** — TypeScript in strict mode everywhere; packages are consumed as TypeScript source.
- **F12-FR-03** — Tests: Vitest for unit and example tests; Playwright for acceptance tests. Tests reference spec IDs (`@M01-AC-1.2`, `M02-EX-irfan`) in their titles.
- **F12-FR-04** — Executable examples are read **directly from the spec files** at test time — there is no second copy to drift.
- **F12-FR-05** — CI gates (plan §8.2) run on every pull request. Gates that are not yet blocking run in report-only mode and say so.
- **F12-FR-06** — Environments: development, staging, production. **Production data is never copied** to any other environment; tests and seeds use synthetic data only.
- **F12-FR-07** — A pull-request template (`.github/pull_request_template.md`) asks for the spec IDs and versions a change implements.
- **F12-FR-08** — Hosting, backups, monitoring and error tracking: **pending ADR-004** (India region, C-07).

## 5. Executable examples

```yaml
id: F12-EX-verhoeff
valid: ["234123412346", "999941057058"]
invalid: ["234123412345", "123456789012", "000000000000"]
```

```yaml
id: F12-EX-masking
cases:
  - { text: "Aadhaar 2341 2341 2346 given", expect: "Aadhaar XXXX XXXX 2346 given" }
  - { text: "id 234123412346.",             expect: "id XXXXXXXX2346." }
  - { text: "phone 9876543210",             expect: "phone 9876543210" }
  - { text: "random 123456789012",          expect: "random 123456789012" }
```

## 6. Data and privacy

CI and test fixtures contain synthetic data only. The Aadhaar scan protects C-03.

## 11. Out of scope

Infrastructure as code, deployment pipelines and monitoring — after ADR-004.

## 13. Open questions

| ID | Question | Proposed default | Blocking? |
|---|---|---|---|
| ADR-004 | India-region provider | Decide in Phase 0 week 2 | Blocks hosting only |
| Q-25 | Recovery targets | RPO ≤ 24 h, RTO ≤ 8 h | No |

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-04 | Seed in `backlog.md` | — |
| 0.2 | 2026-10-04 | Repository and quality-gate scope; built ahead of approval | *Pending* |
