# Specs — register

This folder is the **source of truth** for the behaviour of the Identity Web App. Read [`docs/sdd-plan.md`](../docs/sdd-plan.md) for how specs are written, reviewed, built and verified.

| File | Purpose |
|---|---|
| [`constitution.md`](./constitution.md) | Non-negotiable principles C-01 to C-15. Every plan checks against them. |
| [`backlog.md`](./backlog.md) | Seeded requirements, examples and acceptance scenarios for every spec below, taken from the DPR. |
| [`open-questions.md`](./open-questions.md) | DPR decisions DEC-1 to DEC-6 and spec clarifications Q-01 to Q-25. |
| [`_templates/`](./_templates/) | `spec.md`, `plan.md`, `tasks.md` templates. |

## Starting a spec

1. Copy `_templates/spec.md` to `specs/<ID>-<slug>/spec.md` (e.g. `specs/M02-mismatch-detector/spec.md`).
2. Expand the seed from `backlog.md`; mark unknowns `[NEEDS CLARIFICATION: Q-xx]`.
3. Open a pull request titled `spec(<ID>): …`; book it into the weekly spec review slot.
4. After Gate 1, add `plan.md` (and `data-model.md`, `contracts/` if needed), then `tasks.md`.
5. Update the **Status** column below in the same pull request whenever status changes.

**Status values:** Seeded → Draft → In review → Approved → Planned → In build → Verified → Released (or Superseded).

> **Increment 1 (October 2026).** At the product sponsor's request, F01, F02, F03, F04, F12, M01 and M02 were specified in full and built ahead of Gate 1, using the proposed defaults in `open-questions.md`. They stay *In review* until the product owner and privacy officer are appointed (DEC-2) and approve them; `npm run trace` then starts enforcing full test coverage for them. See [`docs/traceability.md`](../docs/traceability.md).

## Register

| ID | Spec | Phase | Size | Spec approved by | Build | Spec owner (role) | Depends on | Status |
|---|---|---|---|---|---|---|---|---|
| — | [Constitution](./constitution.md) | — | — | Week 1 | — | Product owner + privacy officer | — | Draft |
| F01 | [Domain model, glossary, case lifecycle & persistence](./F01-domain-model/spec.md) | P1 | Full | Week 3 | S1 | Tech lead | Constitution | In review · built in increment 1 |
| F02 | [Document rules & content model](./F02-content-model/spec.md) | P1 | Full | Week 3 | S1 | Tech lead + content lead | F01 | In review · built in increment 1 |
| F03 | [Urbanist UI design system & status system](./F03-design-system/spec.md) | P1 | Full | Week 3 | S1 → S2 | UI/UX designer | — | In review · built in increment 1 |
| F04 | [Internationalisation & RTL](./F04-i18n/spec.md) | P1 | Full | Week 3 | S1 | Tech lead + content lead | F03 | In review · built in increment 1 |
| F05 | [Authentication & sessions](./F05-auth/spec.md) | P1 | Full | Week 3 | S1 | Tech lead | F01, M15 | In review · built in increment 3 |
| F06 | [Privacy, consent & data lifecycle](./F06-privacy/spec.md) | P0 (PRD) | Full | Increment 4 | Inc. 4 (Full Check) → S4 | Privacy officer | F01, F05, M15 | In review · built in increment 4 |
| F07 | [Secure document handling](./F07-secure-documents/spec.md) | P1 | Full | Week 7 | S3 | Tech lead | F01, F06, M15 | In review · built in increment 3 |
| F08 | [Notifications — in-app and SMS](./F08-notifications/spec.md) (WhatsApp after ADR-009) | P1 (PRD) | Full | Increment 6b | Inc. 6b | Tech lead | F01, F04, F05, F06, M04, M09 | In review · built in increment 6b |
| F09 | PWA, performance & offline | P1 | Full | Week 5 | S2 | Tech lead | F02, F03 | Seeded |
| F10 | Trust & safety cues | P1 | Lite | Week 5 | S2 | UI/UX designer | F03, F04 | Seeded |
| F11 | Measurement & KPI events | P1 | Full | Week 9 | S4 | Product owner | F01, F08 | Seeded |
| F12 | [Platform, environments & delivery](./F12-platform/spec.md) | P1 | Full | Week 3 | S1 | Tech lead | ADR-001–004 | In review · built in increment 1 |
| M01 | [Health Check](./M01-health-check/spec.md) | P1 | Full | Week 5 | S2 | Product owner + designer | F02, F03, F04, F09, M02, D01–D03 | In review · built in increment 1 |
| M02 | [Mismatch Detector](./M02-mismatch-detector/spec.md) | P1 | Full | Week 5 | S2 | Product owner + tech lead | F02, D01–D04 | In review · built in increment 1 |
| M03 | Smart Guides | P1 | Full | Week 5 | S2 | Content lead + designer | F02, F09, F10, M13, D01–D04 | Seeded |
| M04 | [Request help and track my case](./M04-request-help/spec.md) | P1 (PRD) | Full | Increment 6a | Inc. 6a | Product owner + designer | F01, F05, F06, F07, M18, M09 | In review · built in increment 6a |
| M05 | Book Appointment | P1 | Full | Week 7 | S3 | Product owner + field coordinator | F01, F05, F08 | Seeded |
| M06 | Reminders | P2 | Full | Week 14 | Month 4 | Product owner | F02, F06, F08, M07 | Seeded |
| M07 | [Family profiles](./M07-family/spec.md) | P1 (PRD) | Full | Increment 6d | Inc. 6d | Product owner + privacy officer | M16, M17, M04, F06 | In review · built in increment 6d |
| M08 | Hub & Scam Alerts | P1 | Lite | Week 5 | S2 | Content lead | F02, F09, F10, M13 | Seeded |
| M09 | [Case queue, case work and SLA](./M09-case-queue/spec.md) (includes M10's filing record) | P1 (PRD) | Full | Increment 6a | Inc. 6a | Field coordinator + designer | F01, F05, F07, M15, M04 | In review · built in increment 6a |
| M10 | Filing Assistant | P1 | Full | Week 9 | S4 | Field coordinator + content lead | M09, M13, D01–D03, F07, F08 | Seeded |
| M11 | Camp Manager | P2 | Full | Week 14 | Month 5 | Field coordinator | M05, M09, M12 | Seeded |
| M12 | Volunteer Hub | P2 | Full | Week 14 | Month 5 | Field coordinator | M15 | Seeded |
| M13 | [Rules admin](./M13-rules-admin/spec.md) (Content Manager: rules database now, guides P1) | P0 (PRD) | Full | Increment 5 | Inc. 5 | Content lead + tech lead | F02, F01, F05, M15 | In review · built in increment 5 |
| M14 | Impact Dashboard | P2 | Full | Week 14 | Month 6 | Product owner | F11, M09, M11, M12 | Seeded |
| M15 | [Access & Audit](./M15-access-audit/spec.md) | P1 | Full | Week 3 | S1 → S4 | Tech lead + privacy officer | F01, F05, F06 | In review · controls in increment 3, staff console in increment 5 |
| M16 | [Citizen profile and target values](./M16-citizen-profile/spec.md) | P0 (PRD) | Full | Increment 2 | Inc. 2 (engine) → 4 (screens) | Product owner + tech lead | F01, M02, F05 | In review · engine in increment 2, screens in increment 4 |
| M17 | [Documents, upload, OCR and verification](./M17-documents-ocr/spec.md) | P0 (PRD) | Full | Increment 4 | Inc. 4 | Tech lead + privacy officer | F01, F02, F07, M16 | In review · built in increment 4 |
| M18 | [Correction roadmap and dependency engine](./M18-correction-roadmap/spec.md) | P0 (PRD) | Full | Increment 2 | Inc. 2 (engine) → 4 (screens) | Product owner + tech lead | M02, M16, F02 | In review · engine in increment 2, screens in increment 4 |
| M19 | [1dentity service fees and payments](./M19-service-fees/spec.md) (online checkout after ADR-016) | P1 (PRD) | Full | Increment 6c | Inc. 6c | Product owner | M04, M09, M13, M15 | In review · built in increment 6c |
| D01 | Aadhaar | P1 | Content | Week 5 | S1–S3 entry | Content lead | F02, M13 | Seed content entered (unverified) |
| D02 | PAN | P1 | Content | Week 5 | S1–S3 entry | Content lead | F02, M13 | Seed content entered (unverified) |
| D03 | Voter ID (EPIC) | P1 | Content | Week 5 | S1–S3 entry | Content lead | F02, M13 | Seed content entered (unverified) |
| D04 | Cross-document journeys | P1 | Content | Week 5 | S2–S3 entry | Content lead | D01–D03 | Seeded |
| D05 | Ration card | P2 | Content | Week 14 | Months 4–6 | Content lead | F02 | Seeded |
| D06 | Birth & death certificates | P2 | Content | Week 14 | Months 4–6 | Content lead | F02 | Seeded |
| D07 | Income, caste & residence certificates | P2 | Content | Week 14 | Months 4–6 | Content lead | F02 | Seeded |
| D08 | Passport | P2 | Content | Week 14 | Months 4–6 | Content lead | F02 | Seeded |
| D09 | Driving licence | P2 | Content | Week 14 | Months 4–6 | Content lead | F02 | Seeded |
| D10 | Scholarship document readiness (NSP, SSP) | P3 | Content | Month 6 | Months 7–12 | Content lead | F02 | Seeded |
| D11 | e-Shram card | P3 | Content | Month 6 | Months 7–12 | Content lead | F02 | Seeded |
| D12 | Ayushman Bharat (PM-JAY) | P3 | Content | Month 6 | Months 7–12 | Content lead | F02 | Seeded |
| D13 | UDID disability card | P3 | Content | Month 6 | Months 7–12 | Content lead | F02 | Seeded |
| D14 | Senior-citizen & pension document checks | P3 | Content | Month 6 | Months 7–12 | Content lead | F02 | Seeded |
| X01 | DigiLocker / API Setu | P3 | Spike → Full | Month 8 | Months 8–10 | Tech lead + privacy officer | Eligibility | Seeded |
| X02 | Partner centres | P3 | Full | Month 6 | Months 7–9 | Product owner | F01, M09, M15 | Seeded |
| O01 | Pilot plan & measurement | P1 | Lite | Week 9 | Weeks 12–14 | Product owner | F11 | Seeded |
| O02 | Incident response & breach runbook | P1 | Lite | Week 9 | S4 | Privacy officer | F06, M15 | Seeded |
| O03 | Content verification operations | P1 | Lite | Week 9 | S4, monthly | Content lead | M13 | Seeded |
| O04 | DPDP readiness check | P2 | Lite | Month 5 | Month 7 | Privacy officer | F06, F07, M15, O02 | Seeded |

**MVP (Phase 1) modules:** M01, M02, M03, M04, M05, M08, M09, M10, M13, M15 — 10 modules, as in DPR §05.

**Developer PRD (October 2026).** The PRD re-prioritises the build into P0 / P1 / P2 and adds M16–M19; see [`docs/prd-reconciliation.md`](../docs/prd-reconciliation.md) and plan §7.7 for the increment sequence.
