# M09 · Case queue, case work and SLA

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P1 (PRD) — increment 6a (includes the filing record of M10; filing scripts stay in M10) |
| **Spec owner** | Field coordinator + designer |
| **Approvers** | Product owner · Field coordinator · Privacy & grievance officer |
| **DPR trace** | §05, §07 (queue "names masked for privacy"), §12 (≤ 3 working days to filing) · **PRD** §16B, §18 (case fields), §19 (dashboard), §23 (least privilege, mask identifiers, audit), §33 ("staff can manage a correction case from intake to completion") |
| **Depends on** | [F01](../F01-domain-model/spec.md) v0.6, [F05](../F05-auth/spec.md), [F07](../F07-secure-documents/spec.md), [M15](../M15-access-audit/spec.md) v0.4, [M04](../M04-request-help/spec.md) |
| **Version** | 0.2 |

> **Approval note.** Built ahead of approval (DEC-2). Defaults applied: Q-08 (working days Monday–Friday minus configured holidays; the clock pauses only in `awaiting_citizen`), Q-09 (deadline within 7 days, then age 60+ or disability, then normal; ties by SLA due date). Desk scoping waits for DEC-3; there is one desk.

## 1. Summary

Staff see a queue of help requests with **masked names**, ordered by **priority and SLA**. A volunteer claims a case (or a supervisor assigns it) and only then can open the citizen's documents for it. They work through a checklist, write notes (internal, or for the citizen), record appointments and the authority's application reference, move the case through the F01 lifecycle, and close it with proof of completion. Everything is audited.

## 3. User stories

### US1 — The queue *(must)*

- **M09-AC-1.1** — *Given* open cases, *when* the queue loads, *then* they are ordered as in `M09-EX-order`, each showing case ID, masked applicant name (`M09-EX-mask`), document, help mode, priority, SLA status, assignee and stage; filters: all open, unassigned, mine, overdue.
- **M09-AC-1.2** — *Given* a case's history, *when* its SLA is computed, *then* working days are counted as in `M09-EX-sla`: Monday–Friday except configured holidays, the request day counts as day 1, days the case ended in `awaiting_citizen` do not count, and the target is filing by working day 3.

### US2 — Least privilege *(must)*

- **M09-AC-2.1** — *Given* an unassigned case, *when* a volunteer claims it, *then* it is assigned to them; *when* a supervisor assigns or reassigns it, *then* it moves; each is a case event and an audit event.
- **M09-AC-2.2** — *Given* a volunteer, *when* they open a case not assigned to them, *then* they see only the queue row; documents, notes and files return "not found" and write `access.denied`. Supervisors and admins see every case.
- **M09-AC-2.3** — *Given* a case, *when* staff choose to see the applicant's full name, *then* a reason is required and `case.name_unmasked` is audited.
- **M09-AC-2.4** — *Given* an assigned case with assistance consent, *when* staff open the citizen's documents for it, *then* they see the confirmed values with numbers masked (M15-AC-2.1), and every file opened writes `case.document_file_viewed`; without consent or after the case ends, access is refused.

### US3 — Working the case *(must)*

- **M09-AC-3.1** — *Given* a case, *when* staff move it, *then* only F01 transitions are offered, closing as "not proceeding" needs a reason, and each move adds a timeline entry visible to the citizen in their language.
- **M09-AC-3.2** — *Given* a new case, *when* created, *then* its checklist holds the rule's required documents followed by the standard steps (`M09-EX-checklist`); staff tick items and who and when is kept.
- **M09-AC-3.3** — *Given* a note, *when* saved, *then* it is internal or for the citizen, and any 12-digit number passing the Aadhaar checksum is masked to its last four digits before it is stored (C-03).
- **M09-AC-3.4** — *Given* the authority's application reference and date, *when* recorded, *then* the case moves to `filed` and the reference is shown to the citizen; appointments and the next action with a due date can be set, and overdue next actions are flagged in the queue.
- **M09-AC-3.5** — *Given* a filed case, *when* staff complete it, *then* a completion date and proof of completion (a file, or a note when the authority issues nothing) are required.
- **M09-AC-3.6** — *Given* a case in `awaiting_citizen`, *when* staff request documents, *then* the request is a citizen-visible note and the citizen can upload them (M04-AC-2.2).

### US4 — Dashboard *(must)*

- **M09-AC-4.1** — *Given* cases, *when* the dashboard loads for staff with `cases.work`, *then* it shows counts of new, unassigned, awaiting citizen, with the authority, overdue (SLA or next action) and completed in the last 30 days, and each staff member's open cases.

### US5 — Retention *(must)*

- **M09-AC-5.1** — *Given* a case that ended (completed, closed or withdrawn) more than 30 days ago, *when* the retention job runs, *then* its files are deleted from storage and marked purged, with one audit event per file (C-05).

## 4. Functional requirements

- **M09-FR-01** — Permissions (M15): `cases.work` (volunteer, supervisor, admin) — see the queue, claim, work assigned cases; `cases.manage` (supervisor, admin) — open any case, assign and reassign.
- **M09-FR-02** — Case IDs `ID-` + five or more digits from a database sequence (F01-FR-08); the ID alone never grants access.
- **M09-FR-03** — Case events record from, to, time, actor kind and id, reason and a citizen-visible flag; the citizen timeline is built from them.
- **M09-FR-04** — Holidays come from `CASE_HOLIDAYS` (comma-separated `YYYY-MM-DD`), until the coordinator maintains a calendar (DEC-3, Q-08).
- **M09-FR-05** — Audit events: `case.claimed`, `case.assigned`, `case.state_changed`, `case.name_unmasked`, `case.note_added`, `case.task_done`, `case.filed`, `case.completed`, `case.documents_viewed`, `case.document_file_viewed`, `case.file_viewed`, `access.denied`.

## 5. Executable examples

```yaml
id: M09-EX-sla
holidays: ["2026-10-12"]
cases:
  - { name: created Friday, Monday holiday, on Wednesday, created: "2026-10-09T10:00:00+05:30", events: [], now: "2026-10-14T12:00:00+05:30", expect: { day: 3, due: "2026-10-14", status: due_today } }
  - { name: next working day, created: "2026-10-05T09:00:00+05:30", events: [], now: "2026-10-06T09:00:00+05:30", expect: { day: 2, due: "2026-10-07", status: on_track } }
  - { name: overdue, created: "2026-10-05T09:00:00+05:30", events: [], now: "2026-10-09T09:00:00+05:30", expect: { day: 5, due: "2026-10-07", status: overdue } }
  - name: paused while awaiting the citizen
    created: "2026-10-05T09:00:00+05:30"
    events:
      - { to: awaiting_citizen, at: "2026-10-05T15:00:00+05:30" }
      - { to: in_progress, at: "2026-10-07T11:00:00+05:30" }
    now: "2026-10-07T12:00:00+05:30"
    expect: { day: 1, due: "2026-10-09", status: on_track }
  - name: stopped when filed
    created: "2026-10-05T09:00:00+05:30"
    events: [{ to: in_progress, at: "2026-10-05T10:00:00+05:30" }, { to: filed, at: "2026-10-06T16:00:00+05:30" }]
    now: "2026-10-20T12:00:00+05:30"
    expect: { day: 2, due: "2026-10-07", status: met }
```

```yaml
id: M09-EX-order
today: "2026-10-14"
cases:
  - { id: a, priority: [], due: "2026-10-15" }
  - { id: b, priority: [age60], due: "2026-10-16" }
  - { id: c, priority: [deadline], deadline: "2026-10-18", due: "2026-10-17" }
  - { id: d, priority: [deadline], deadline: "2026-11-30", due: "2026-10-14" }
  - { id: e, priority: [disability], due: "2026-10-15" }
expect: [c, e, b, d, a]
```

```yaml
id: M09-EX-mask
cases:
  - { name: "Mohammed Ibrahim", masked: "Mohammed I." }
  - { name: "Fatima", masked: "Fatima" }
  - { name: "", masked: "(no name given)" }
```

```yaml
id: M09-EX-checklist
standard:
  - Confirm the target details with the citizen
  - Check the documents needed
  - Book or confirm the visit, if needed
  - File the application on the official portal (the citizen enters any OTP)
  - Record the application reference
  - Share progress with the citizen
```

## 6. Data and privacy

| Data item | Purpose | Basis | Stored where | Who can see it | Retention | Deleted by |
|---|---|---|---|---|---|---|
| Case, events, checklist | Run the case | `assistance` consent | Database | Assigned volunteer, supervisors, admins; the citizen | Anonymised 12 months after closure (Q-14, later increment) | Account deletion |
| Notes | Coordination and messages to the citizen | `assistance` | Database (Aadhaar numbers masked on save) | Internal notes: staff on the case; citizen notes: also the citizen | As the case | As the case |
| Case files (requested documents, proof) | Filing and proof of completion | `assistance` | Encrypted object store | As the case | 30 days after the case ends | Retention job |

## 11. Out of scope

Desk scoping and slot booking (M05), filing scripts per portal (M10), SMS/WhatsApp messages (F08), payment (M19), anonymisation job (Q-14), walk-in cases created at the desk (Q-05).

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-04 | Seed in `backlog.md` | — |
| 0.2 | 2026-10-05 | Full spec from the Developer PRD for increment 6a | *Pending* |
