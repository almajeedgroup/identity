# <ID> · Implementation plan

| | |
|---|---|
| **Spec** | [`spec.md`](./spec.md) v<x.y> |
| **Status** | Draft · Planned |
| **Author** | <developer> |
| **Reviewers** | Tech lead · QA & security |

## 1. Approach

One or two paragraphs: how the spec will be met, and the main design choice.

## 2. Constitution check

| Principle | Applies? | How it is satisfied | Exception (with approval and removal date) |
|---|---|---|---|
| C-01 Facilitation, not impersonation | | | |
| C-02 Never handle government credentials | | | |
| C-03 Masked Aadhaar only | | | |
| C-04 Collect only with consent, only for the case | | | |
| C-05 Retention by default | | | |
| C-06 Least-privilege access | | | |
| C-07 Secure and resident by design | | | |
| C-08 Four languages, equal quality | | | |
| C-09 Accessible by default | | | |
| C-10 Mobile-first and light | | | |
| C-11 Assisted everywhere | | | |
| C-12 Plain language, one next step | | | |
| C-13 Content is verifiable | | | |
| C-14 No advertising trackers; aggregates only | | | |
| C-15 Lean, maintainable stack | | | |
| C-16 Original data is preserved | | | |
| C-17 The citizen decides | | | |
| C-18 Recommendations, not rulings | | | |

## 3. Components touched

| Area | Change |
|---|---|
| Routes / screens (`apps/web`) | |
| API routes | |
| `packages/rules` | |
| `packages/content-schema` | |
| `packages/ui` | |
| Background jobs | |
| External services | |

## 4. Data model

Link to [`data-model.md`](./data-model.md). Summarise new entities and fields, each with its **retention class**, and the migration.

## 5. Contracts

Files in [`contracts/`](./contracts/): OpenAPI fragments, event schemas, WhatsApp/SMS templates, content schemas.

## 6. Security and privacy design

- Access rules per role
- Audit events emitted
- Threats considered and mitigations
- Data leaving the device or the India region (should be none)

## 7. Test strategy

| Acceptance criterion / example | Test level | Test location |
|---|---|---|
| <ID>-AC-1.1 | Acceptance (Playwright) | `tests/acceptance/<ID>/…` |
| <ID>-EX-<slug> | Unit (Vitest, fixture) | `packages/rules/…` |

## 8. Rollout

Feature flags, data migration, content seeding, translation freeze date, pilot configuration.

## 9. Risks and ADRs

| Risk / decision | Mitigation / ADR |
|---|---|
| | |
