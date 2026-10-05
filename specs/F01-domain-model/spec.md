# F01 · Domain model, glossary and case lifecycle

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P1 |
| **Spec owner** | Tech lead |
| **Approvers** | Product owner · Privacy & grievance officer · Field coordinator |
| **PRD trace** | §8, §9, §25 (core database entities), §28 |
| **DPR trace** | §05, §06, §07 (screen concepts "My case" and "Case queue"), §09 |
| **Depends on** | [Constitution](../constitution.md) |
| **Version** | 0.4 |

> **Approval note.** Approvers are not yet appointed (DEC-2). This spec is built ahead of approval at the product sponsor's request, using the proposed defaults in [`open-questions.md`](../open-questions.md). Anything built from it is provisional until Gate 1.

## 1. Summary

The citizen app, the staff console and the admin surface must use the same words for the same things, and a case must move through the same stages whether a citizen or a volunteer is looking at it. This spec defines the glossary, the core entities and the **case lifecycle** — the state machine behind the citizen's "My case" timeline and the volunteer's case queue in DPR §07.

## 2. Users and scenarios

- **Citizens** (all personas) follow a case they opened and need to know, in plain words, where it is.
- **Volunteers and supervisors** move cases through stages and need the SLA clock to reflect reality (paused while waiting on the citizen).
- **IIC leadership** needs consistent stages so the Impact Dashboard (M14) counts the same thing every month.

## 3. User stories

### US1 — Clear case stages for citizens *(priority: must)*

As a citizen, I want my case to move through a few clear stages, so that I always know where it is and what happens next.

- **F01-AC-1.1** — *Given* a case has just been created, *when* its state is read, *then* it is `new` and the citizen sees the stage "Request received".
- **F01-AC-1.2** — *Given* a case in `filed`, *when* staff record that it is with the authority, *then* the state is `with_authority` and the citizen sees "With the authority · usually 2–3 weeks".
- **F01-AC-1.3** — *Given* a case in `new`, *when* anyone tries to move it straight to `completed`, *then* the transition is rejected and the state is unchanged.

### US2 — Stages that drive the volunteer's work *(priority: must)*

As a volunteer, I want each stage to tell me whether the SLA clock is running and which moves are allowed, so that the queue is fair and accurate.

- **F01-AC-2.1** — *Given* a case in `awaiting_citizen`, *when* the SLA is calculated, *then* the clock is paused; in every other non-terminal state it runs.
- **F01-AC-2.2** — *Given* any non-terminal case, *when* the citizen withdraws it, *then* the state becomes `withdrawn`; *given* a terminal case, *then* no further transition is allowed.
- **F01-AC-2.3** — *Given* a case is closed without completing, *when* no closure reason is given, *then* the transition to `closed_not_proceeding` is rejected.

### US3 — Readable case IDs *(priority: must)*

As a citizen or volunteer, I want a short case ID I can read out over the phone, so that we can talk about the same case.

- **F01-AC-3.1** — *Given* a case number, *when* it is formatted, *then* it reads `ID-` followed by at least five digits (e.g. `ID-24318`), and strings in any other shape are not accepted as case IDs.

### US4 — The database keeps every promise *(must)* — v0.3

- **F01-AC-4.1** — *Given* a document field's original value, *when* anything tries to change it, *then* the database refuses (C-16); confirmed values can change, and a new document version is created for edits after verification.
- **F01-AC-4.2** — *Given* migrations, *when* applied to an empty database, *then* they succeed on both embedded PostgreSQL (PGlite) and PostgreSQL 16, and applying them twice changes nothing.
- **F01-AC-4.3** — *Given* a citizen account is deleted, *when* the deletion completes, *then* their profile, targets, overrides, documents, versions, fields, extractions, uploads, analyses and consents are gone, and only pseudonymous audit events remain (F06).

## 4. Functional requirements

### Glossary

| Term | Meaning |
|---|---|
| **Citizen** | Anyone using the public app. No account is needed for the Health Check, guides or Hub. |
| **Account holder** | A citizen who has logged in with a one-time code to their own mobile (F05). |
| **Applicant** | The person a case is about. May differ from the account holder (e.g. a son helping his father) — see Q-05. |
| **Document** | A government-issued record: Aadhaar, PAN, Voter ID (EPIC) at P1. |
| **Field** | A detail printed on a document: name, date of birth, gender, address, plus the Aadhaar mobile link. |
| **Issue** | Something to fix on a document. Either a **mismatch** (differs from the reference document) or **update due** (incomplete or out of date). |
| **Reference document** | The document others are aligned to — Aadhaar by default (Q-02, M02). |
| **Health score** | 0–100 summary of a Health Check (M01). |
| **Case** | A request for help with one service for one applicant, tracked by a case ID. |
| **Service** | The type of help, e.g. "PAN · name correction", "Voter ID · shifting (Form 8)". |
| **Centre / desk** | An Identity help location. A centre has one or more desks. Exists from day one so partner centres (X02) extend the model. |
| **Appointment, slot, camp, token** | Booked help-desk time, the time unit offered, a community document drive, and a camp queue number with QR (M05, M11). |
| **Volunteer, doorstep team, supervisor, coordinator** | Staff roles that work cases (M15). |
| **Content editor, language reviewer, publisher** | Roles that maintain guides, rules and fees (M13). |
| **Privacy & grievance officer** | The designated IIC staff member for consent, rights requests and incidents. |

### Entities (conceptual; the database schema is defined in each feature's `data-model.md`)

- **F01-FR-01** — The system MUST model: `Account`, `Applicant`, `Centre`, `Desk`, `Case`, `CaseEvent`, `Appointment`, `Slot`, `Camp`, `Token`, `StaffUser`, `Role`, `Assignment`, `Upload`, `ConsentRecord`, `Notification`, `AuditEvent`, `RightsRequest`, `SurveyResponse`. Content entities are defined in F02.
- **F01-FR-02** — Every stored entity and field MUST carry one **retention class**: `device_only`, `uploads_30d_after_closure`, `case_anonymise_12m`, `audit` (period per Q-15), `consent` (period per Q-15), `content_versioned`, `config`.

### Persistence (v0.3, PRD §25)

- **F01-FR-09** — PostgreSQL schema (Drizzle, ADR-011). P0 tables: `users`, `otp_challenges`, `staff_users`, `staff_roles`, `sessions`, `consents`, `citizen_profiles`, `master_values`, `target_changes`, `overrides`, `documents`, `document_versions`, `document_fields`, `ocr_extractions`, `uploads`, `analysis_runs`, `kb_items`, `audit_logs`, `dev_outbox`. P1 adds `family_groups`, `cases`, `case_tasks`, `case_documents`, `case_notes`, `appointments`, `payments`, `notifications`.
- **F01-FR-10** — `document_fields` keeps `original`, `normalised` and `confirmed` values per document version (C-16); a trigger rejects any change to `original`.
- **F01-FR-11** — Knowledge-base items (`kb_items`) are versioned rows `(kind, key, version)` with JSON data validated by F02; the engine uses, per item, the latest `published` version, otherwise the latest `in_review` one; a `withdrawn` latest version removes the item; drafts are never used.
- **F01-FR-12** — Comparison results are stored as `analysis_runs` snapshots (engine output + knowledge-base version) so staff and citizens can see what a report said at the time.
- **F01-FR-13** — Every citizen-owned row references the user and is deleted with the account (cascade); audit rows are never deleted (M15).

### Case lifecycle

- **F01-FR-03** — A case MUST be in exactly one of these states:

  | State | Citizen sees | Staff sees | SLA clock | Terminal |
  |---|---|---|---|---|
  | `new` | Request received | New | Running | No |
  | `awaiting_citizen` | We need something from you | Awaiting citizen | **Paused** | No |
  | `visit_booked` | Appointment booked | Visit booked | Running | No |
  | `in_progress` | Documents checked | In progress | Running | No |
  | `filed` | Filed on official portal · acknowledgement shared | Filed | Stopped (target met or missed) | No |
  | `with_authority` | With the authority · usually 2–3 weeks | With authority | Stopped | No |
  | `completed` | Completed | Completed | Stopped | Yes |
  | `closed_not_proceeding` | Closed | Closed | Stopped | Yes |
  | `withdrawn` | Withdrawn | Withdrawn | Stopped | Yes |

- **F01-FR-04** — Only these transitions are allowed (any other MUST be rejected):

  | From | To |
  |---|---|
  | `new` | `in_progress`, `visit_booked`, `awaiting_citizen` |
  | `awaiting_citizen` | `in_progress`, `visit_booked` |
  | `visit_booked` | `in_progress`, `awaiting_citizen` |
  | `in_progress` | `awaiting_citizen`, `visit_booked`, `filed` |
  | `filed` | `with_authority`, `completed`, `awaiting_citizen` *(authority raised a query)* |
  | `with_authority` | `completed`, `awaiting_citizen` *(authority raised a query)* |
  | any non-terminal | `withdrawn`, `closed_not_proceeding` |

- **F01-FR-05** — A move to `closed_not_proceeding` MUST carry a reason: `rejected_by_authority`, `not_reachable`, `out_of_scope`, `duplicate` or `other`.
- **F01-FR-06** — The SLA (target ≤ 3 working days from request to filing, DPR §12) runs from `new` until `filed`, and is paused while `awaiting_citizen` (Q-08 default). The working-day calendar is defined in M09.
- **F01-FR-07** — Every transition MUST be recorded as a `CaseEvent` (from, to, time, actor role, optional reason). The citizen timeline is built from these events.
- **F01-FR-08** — Case IDs MUST have the form `ID-` + digits (at least five). A case ID alone MUST NOT grant access to a case (enforced in F05/M04).

## 5. Executable examples

```yaml
id: F01-EX-transitions
cases:
  - { from: new, to: in_progress, allowed: true }
  - { from: new, to: completed, allowed: false }
  - { from: in_progress, to: filed, allowed: true }
  - { from: filed, to: with_authority, allowed: true }
  - { from: with_authority, to: completed, allowed: true }
  - { from: with_authority, to: in_progress, allowed: false }
  - { from: awaiting_citizen, to: withdrawn, allowed: true }
  - { from: completed, to: withdrawn, allowed: false }
  - { from: withdrawn, to: new, allowed: false }
  - { from: visit_booked, to: closed_not_proceeding, allowed: true, reason: not_reachable }
  - { from: visit_booked, to: closed_not_proceeding, allowed: false }
```

```yaml
id: F01-EX-case-ids
cases:
  - { number: 24318, formatted: ID-24318 }
  - { number: 7, formatted: ID-00007 }
valid: [ID-24318, ID-00007, ID-1234567]
invalid: [24318, id-24318, ID-12, ID-24A18, "ID- 24318"]
```

## 6. Data and privacy

This spec defines structure only; it stores nothing by itself.

| Data item | Purpose | Consent / basis | Stored where | Who can see it | Retention | Deleted or anonymised by |
|---|---|---|---|---|---|---|
| Case state and events | Track progress; measure SLA | Case consent (F06) | Database | Account holder; assigned volunteer and supervisor (C-06) | `case_anonymise_12m` | M15 job |
| Closure reason | Reporting and follow-up | Case consent | Database | As above | `case_anonymise_12m` | M15 job |

- Audit events: none directly; state changes are `CaseEvent`s. Staff access to case data is audited by M15.
- Constitution principles engaged: C-05 (retention classes), C-06 (who sees a case).

## 7. Language, accessibility and assisted mode

- Stage labels are citizen-facing and MUST exist in en, kn, hi, ur when the case tracker ships (M04). This spec fixes the English wording above.
- Stage labels are shown with an icon and the word, never colour alone (C-09).
- Assisted mode: volunteers move cases on the citizen's behalf; every move is attributed to a staff role in `CaseEvent`.

## 8. Non-functional requirements

- The state machine is a pure function in `packages/domain`, shared by the server and the browser.

## 9. Content dependencies

None.

## 10. Edge cases and failure modes

- Authority raises a query after filing → `awaiting_citizen` (SLA is already stopped at `filed`; the pause has no effect on it).
- Official portal down → case stays `in_progress`; M09 shows the reason in notes; no special state.
- Duplicate case opened → `closed_not_proceeding` with reason `duplicate`.

## 11. Out of scope

- Database schema and migrations (in each feature's `data-model.md`).
- Working-day calendar and priority rules (M09).
- Who may perform which transition (M15 permissions).

## 12. Success measures

Request-to-filed working days and cases resolved are computable from `CaseEvent`s (F11).

## 13. Open questions

| ID | Question | Proposed default | Blocking? |
|---|---|---|---|
| Q-05 | Account holder vs applicant | Separate `Applicant` entity | No (applied) |
| Q-08 | What pauses the SLA | Only `awaiting_citizen` | No (applied) |

## 14. Gate 1 checklist — spec ready

- [x] Stories prioritised; each independently testable
- [x] Every story has Given/When/Then acceptance scenarios with IDs
- [x] Executable examples for every rule
- [ ] Data and privacy table signed off by the privacy officer *(not yet appointed)*
- [x] Languages, accessibility and assisted mode described
- [x] Content dependencies listed
- [x] Out of scope explicit
- [x] No blocking `[NEEDS CLARIFICATION]` remains

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-04 | Seed in `backlog.md` | — |
| 0.2 | 2026-10-04 | Full draft; built ahead of approval with proposed defaults | *Pending* |
| 0.3 | 2026-10-05 | Persistence for the Developer PRD: P0 tables, immutable originals, versioned knowledge base, analysis snapshots, cascade deletion | *Pending* |
| 0.4 | 2026-10-05 | `target_changes` table (M16 v0.2 target history), migration `0002` | *Pending* |
