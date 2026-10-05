# M16 · Citizen profile and target values

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P0 (PRD) |
| **Spec owner** | Product owner + tech lead |
| **Approvers** | Product owner · Privacy & grievance officer |
| **DPR trace** | §03 (personas), §06 · **PRD** §7 (steps 2, 10, 18), §8, §17, §21, §28 |
| **Depends on** | [F01](../F01-domain-model/spec.md), [M02](../M02-mismatch-detector/spec.md), [F05](../F05-auth/spec.md) |
| **Version** | 0.1 |

> **Approval note.** Specified from the Developer PRD and built ahead of approval (DEC-2). The suggestion engine is built in increment 2; the stored profile and screens in increment 4.

## 1. Summary

To fix a set of documents, a citizen first has to decide what the *right* details are — the name, date of birth and parents' names they want every document to show. This spec defines the **master citizen profile** and its **target values**: the engine suggests a target for each field and shows which documents support it, the citizen confirms or changes it, and the system never changes a confirmed target on its own (C-17). It also defines how a citizen or staff member can dispute a comparison result.

## 2. Users and scenarios

- A citizen running a Full Check for themselves; a family member doing it for a parent (M07, P1).
- PRD §17: birth certificate "Mohamad Ibrahim", SSLC and Aadhaar "Mohammed Ibrahim", PAN "Ibrahim Mujeeb" — the citizen must choose which name to establish.

## 3. User stories

### US1 — A profile separate from my documents *(must)*

- **M16-AC-1.1** — *Given* a citizen with documents, *when* their profile is saved, *then* the target values are stored apart from every document's original, normalised and confirmed values, and saving a target never changes a document value (C-16).

### US2 — Suggestions with reasons *(must)*

- **M16-AC-2.1** — *Given* the cases in `M16-EX-suggestions`, *when* targets are suggested, *then* the suggested value, the supporting documents and the reason are as listed.
- **M16-AC-2.2** — *Given* a field where no two documents agree, *when* a suggestion is shown, *then* the citizen sees every value with its documents and is asked to choose; nothing is pre-confirmed.

### US3 — I confirm; nothing changes behind my back *(must)*

- **M16-AC-3.1** — *Given* a suggested target, *when* the citizen has not confirmed it, *then* reports and roadmaps say the target is not confirmed and the roadmap begins with "Confirm your target details".
- **M16-AC-3.2** — *Given* a confirmed target, *when* new documents make a different value the majority, *then* the confirmed target stays, and the citizen is told the suggestion now differs (`M16-EX-stability`).
- **M16-AC-3.3** — *Given* a citizen changes a confirmed target, *when* they save, *then* the old and new values, time and actor are recorded in the audit log.

### US4 — Disputes and overrides *(must)*

- **M16-AC-4.1** — *Given* a comparison result, *when* the citizen marks it "this is the same" or "this needs correcting" with a reason, *then* the decision is stored with an audit entry and the report shows it as overridden (M02-FR-23).
- **M16-AC-4.2** — *Given* staff override a result on a citizen's behalf, *when* they save, *then* a reason is required and the staff member is recorded.

### US5 — Re-run after corrections *(must)*

- **M16-AC-5.1** — *Given* a citizen updates a document after a correction, *when* they re-run the check, *then* the comparison uses their confirmed targets and the report shows which issues are now resolved.

## 4. Functional requirements

- **M16-FR-01** — Profile fields (PRD §8): full name (target), date of birth, gender, father's, mother's and spouse's names, place of birth, current address, permanent address, mobile number, email, state, district, language preference; plus derived lists: documents available, issues found, correction status.
- **M16-FR-02** — Each **target value** records: field, value, status (`suggested` or `confirmed`), source (`suggestion`, `document:<id>`, `manual`), confirmed-at, confirmed-by.
- **M16-FR-03** — **Suggestion rule**: group the documents' values into formatting-equivalent groups (M02-FR-22); choose the group with the **most documents**; break ties by the **lowest document tier** (civil first, M18), then by document order in the catalogue. The displayed value is the value as written on the highest-ranked document in the group. Reason: `only_value`, `majority` or `tie_foundational`.
- **M16-FR-04** — For **address**, the citizen's stated current address is the suggestion when present (reason `profile`); otherwise the rule above applies.
- **M16-FR-05** — A suggestion is never treated as confirmed. A confirmed target changes only by an explicit citizen action (or staff with a reason), and every change is audited (C-17).
- **M16-FR-06** — **Overrides** store: document, field, decision (`accepted_equivalent`, `requires_correction`), reason, actor, time. Overrides are inputs to M02; they never change document values.
- **M16-FR-07** — Mobile number and email are contact details, not compared fields.

## 5. Executable examples

```yaml
id: M16-EX-suggestions
cases:
  - name: PRD §17 — majority wins
    field: name
    values:
      - { id: birth,   kind: birth_certificate, value: "Mohamad Ibrahim" }
      - { id: sslc,    kind: sslc,              value: "Mohammed Ibrahim" }
      - { id: aadhaar, kind: aadhaar,           value: "MOHAMMED IBRAHIM" }
      - { id: pan,     kind: pan,               value: "Ibrahim Mujeeb" }
    expect: { value: "Mohammed Ibrahim", supportedBy: [sslc, aadhaar], reason: majority }
  - name: tie broken by the most foundational document
    field: name
    values:
      - { id: pan,   kind: pan,               value: "Fatima Ansari" }
      - { id: birth, kind: birth_certificate, value: "Fatima Shaikh" }
    expect: { value: "Fatima Shaikh", supportedBy: [birth], reason: tie_foundational }
  - name: only one value
    field: dob
    values:
      - { id: aadhaar, kind: aadhaar, value: "12/04/2002" }
      - { id: pan,     kind: pan,     value: "12-04-2002" }
    expect: { value: "12/04/2002", supportedBy: [aadhaar, pan], reason: only_value }
  - name: address comes from the profile when given
    field: address
    profileAddress: { line: "12, 3rd Cross, Shivajinagar", city: "Bengaluru", pin: "560051" }
    values:
      - { id: aadhaar, kind: aadhaar, value: { line: "8, Station Road", city: "Kalaburagi", pin: "585101" } }
    expect: { value: { line: "12, 3rd Cross, Shivajinagar", city: "Bengaluru", pin: "560051" }, supportedBy: [], reason: profile }
```

```yaml
id: M16-EX-stability
confirmed: { field: name, value: "Fatima Shaikh" }
values:
  - { id: aadhaar, kind: aadhaar, value: "Fatima Shaikh" }
  - { id: pan,     kind: pan,     value: "Fatima Ansari" }
  - { id: voter,   kind: voter_id, value: "Fatima Ansari" }
expect:
  target: { value: "Fatima Shaikh", status: confirmed }
  suggestionDiffers: true
  suggestion: "Fatima Ansari"
```

## 6. Data and privacy

| Data item | Purpose | Consent / basis | Stored where | Who can see it | Retention | Deleted or anonymised by |
|---|---|---|---|---|---|---|
| Profile and target values | Compare documents; build the roadmap | Full Check consent (F06) | Database | The citizen; staff only within an assistance case (P1) | Until the citizen deletes them or their account | Settings → delete (F06) |
| Overrides with reasons | Respect the citizen's decisions; audit | Full Check consent | Database | As above | As above | As above |
| Mobile number, email | Sign-in and contact | Account (F05) | Database | The citizen; staff in a case | Account lifetime | Account deletion |

Audit events: `target.confirmed`, `target.changed`, `comparison.overridden`.

## 7. Language, accessibility and assisted mode

Target choices show every value as written with its documents, in all four languages; names are never translated. In assisted mode a volunteer can propose a target, but only the citizen confirms it (or staff with a recorded reason when the citizen instructs them in person).

## 11. Out of scope

Family members' profiles (M07, P1); document storage (M17).

## 13. Open questions

| ID | Question | Proposed default | Blocking? |
|---|---|---|---|
| Q-02 | Reference document | Superseded: the citizen chooses | No |

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-05 | First draft from the Developer PRD | *Pending* |
