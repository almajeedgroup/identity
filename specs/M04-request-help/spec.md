# M04 · Request help and track my case

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P1 (PRD) — increment 6a |
| **Spec owner** | Product owner + designer |
| **Approvers** | Product owner · Privacy & grievance officer · Field coordinator |
| **DPR trace** | §01, §05, §06, §07 ("My case" tracker) · **PRD** §16B (get 1dentity assistance), §18 (case fields), §28 (fees separate), §33 ("the user can choose DIY or 1dentity assistance") |
| **Depends on** | [F01](../F01-domain-model/spec.md) v0.6, [F05](../F05-auth/spec.md), [F06](../F06-privacy/spec.md) v0.3, [F07](../F07-secure-documents/spec.md), [M18](../M18-correction-roadmap/spec.md), [M09](../M09-case-queue/spec.md) |
| **Version** | 0.2 |

> **Approval note.** Built ahead of approval (DEC-2) in increment 6a. Help modes are recorded as a preference; booking desk slots is M05. Messages to the citizen arrive with F08 (increment 6b); payment of the service fee with M19 (increment 6c). Cases are for the account holder's own documents; family members come with M07 (increment 6d, Q-05).

## 1. Summary

Every correction step in the roadmap offers two paths: **do it yourself** (M18) or **ask 1dentity to help**. Asking for help opens a **case** with an ID like `ID-00042`, after the citizen agrees that a trained volunteer may see the documents needed for that correction. The citizen follows the case in a tracker, answers requests, and can withdraw at any time.

## 3. User stories

### US1 — Ask for help from a correction step *(must)*

- **M04-AC-1.1** — *Given* a correction step in the roadmap, *when* the citizen chooses "Ask 1dentity to help", *then* they see what is included, the 1dentity service fee (or "to be confirmed") **separately** from the government fee paid to the authority (C-01), a choice of help mode (help desk, WhatsApp video call, home visit for people who cannot travel), optional priority information (age 60 or over, disability, a deadline), and the assistance notice.
- **M04-AC-1.2** — *Given* the citizen has not agreed to the assistance notice, *when* they submit, *then* no case is created (F06-AC-1.3).
- **M04-AC-1.3** — *Given* agreement, *when* the request is submitted, *then* a case is created in state `new` with a case ID shown on screen, and it records the document, the issues (field, current value, target), the rule and version used, the government fees, the service fee, the help mode and the priority information — a snapshot that later rule changes do not alter.
- **M04-AC-1.4** — *Given* an open case for the same document, *when* the citizen asks again, *then* they are taken to the existing case instead of a duplicate.

### US2 — Follow my case *(must)*

- **M04-AC-2.1** — *Given* a case, *when* the citizen opens it, *then* they see the case ID, the current stage in their language, a timeline with dates, the first name and initial of the assigned volunteer, notes written for them, the application reference once filed, the next appointment, and the warning that 1dentity never asks for an OTP, PIN or password.
- **M04-AC-2.2** — *Given* a case in `awaiting_citizen`, *when* the citizen replies with a message or uploads a requested document (JPG, PNG or PDF; full Aadhaar numbers refused, F07, C-03), *then* it is added to the case for the assigned staff and the timeline shows it.
- **M04-AC-2.3** — *Given* an open case, *when* the citizen withdraws it with confirmation, *then* it moves to `withdrawn`, staff can no longer open the citizen's documents through it, and its files follow case retention (M09-AC-5.1).

### US3 — Consent stays in the citizen's hands *(must)*

- **M04-AC-3.1** — *Given* a citizen withdraws the assistance consent (F06), *when* confirmed, *then* every open case is withdrawn and staff access ends at once.

## 4. Functional requirements

- **M04-FR-01** — Help modes: `desk`, `whatsapp_video`, `doorstep`. Priority information: `age60` (self-declared), `disability` (self-declared), `deadline` (a date and what it is for, max 120 characters).
- **M04-FR-02** — The case snapshot is stored with the case (`issues`, `rule`, `governmentFees`, `serviceFee`); the roadmap may change later, the case does not.
- **M04-FR-03** — Citizen-facing stage names come from F01 (`request_received`, `need_from_you`, `appointment_booked`, `documents_checked`, `filed`, `with_authority`, `completed`, `closed`, `withdrawn`) and exist in all four languages.
- **M04-FR-04** — The volunteer is shown as first name and initial ("Sana M."); staff email and roles are never shown to citizens.
- **M04-FR-05** — Audit events: `case.requested`, `case.citizen_replied`, `case.file_added`, `case.withdrawn_by_citizen`.

## 5. Executable examples

```yaml
id: M04-EX-staff-name
cases:
  - { name: "Sana Mirza", shown: "Sana M." }
  - { name: "Abdul Raheem Khan", shown: "Abdul K." }
  - { name: "Priya", shown: "Priya" }
```

## 6. Data and privacy

| Data item | Purpose | Consent | Stored where | Who can see it | Retention | Deleted by |
|---|---|---|---|---|---|---|
| Case and snapshot | Provide the help asked for | `assistance` | Database | Citizen; assigned volunteer and supervisors (M09) | Case anonymised 12 months after closure (C-05, Q-14 — job in a later increment) | Account deletion; anonymisation |
| Citizen replies and case files | Complete the correction | `assistance` | Database; encrypted object store | As above | Files purged 30 days after the case ends (C-05) | Retention job; account deletion |

## 7. Language, accessibility and assisted mode

All citizen screens in four languages; the tracker is readable at 360 px and in large-text mode.

## 11. Out of scope

Booking desk slots (M05), messages (F08, 6b), paying the fee (M19, 6c), cases for family members (M07, 6d), desk-created cases for people with no phone (Q-05, later).

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-04 | Seed in `backlog.md` | — |
| 0.2 | 2026-10-05 | Full spec from the Developer PRD for increment 6a | *Pending* |
