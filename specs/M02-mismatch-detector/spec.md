# M02 · Mismatch Detector

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P1 |
| **Spec owner** | Product owner + tech lead |
| **Approvers** | Product owner · Privacy & grievance officer |
| **DPR trace** | §01 ("Compares"), §03 (impact hotspots), §05, §06 (worked example) |
| **Depends on** | [F01](../F01-domain-model/spec.md), [F02](../F02-content-model/spec.md), D01–D04 |
| **Version** | 0.2 |

> **Approval note.** Built ahead of approval at the product sponsor's request. Proposed defaults for Q-02 (reference document) and Q-03 (name variants) are applied and marked below.

## 1. Summary

Small differences between documents — "Mohd." on PAN but "Mohammed" on Aadhaar, a different date of birth on the Voter ID, an old address — block bank KYC, scholarships, pensions and PAN–Aadhaar linking (DPR §02, §03). The Mismatch Detector compares the details a citizen enters from each card, explains every difference in plain language, and produces an **ordered action plan**. It runs entirely on the citizen's device (C-04).

## 2. Users and scenarios

- **Fatima** (PAN still shows her maiden surname), **Ravi** (Aadhaar shows only his birth year), **Ayesha** (name spelt differently), **Suresh** (moved to Bengaluru) — DPR §03.
- Used inside the Health Check (M01), on the citizen's phone or on a help-desk tablet with a volunteer.

## 3. User stories

### US1 — Compare my documents against one reference *(must)*

As a citizen, I want my documents compared against one reference document, so that I know which ones to correct.

- **M02-AC-1.1** — *Given* the DPR worked example (`M02-EX-irfan`), *when* compared, *then* the field results, issues and action plan match the DPR exactly.
- **M02-AC-1.2** — *Given* the citizen has no Aadhaar, *when* compared, *then* PAN is the reference; *given* neither Aadhaar nor PAN, *then* Voter ID is the reference (`M02-EX-reference`).
- **M02-AC-1.3** — *Given* a field that is not printed on a document (e.g. gender on PAN) or was not entered, *when* compared, *then* that cell is "not applicable" and raises no issue.

### US2 — Explain name differences fairly *(must)*

As a citizen, I want small differences in my name explained, so that I understand why "Mohd." matters.

- **M02-AC-2.1** — *Given* each pair of names in `M02-EX-names`, *when* compared, *then* the classification and reason are as listed.
- **M02-AC-2.2** — *Given* any reason code the detector can return, *when* the app renders it, *then* a plain-language explanation exists in en, kn, hi and ur.

### US3 — Dates of birth, including year-only *(must)*

- **M02-AC-3.1** — *Given* each case in `M02-EX-dob`, *when* compared, *then* the issues are as listed — including a **year-only** date of birth being flagged on the document that shows only the year.

### US4 — Gender and address *(must)*

- **M02-AC-4.1** — *Given* the Voter ID gender differs from Aadhaar, *then* the Voter ID gets a gender mismatch (`M02-EX-gender`).
- **M02-AC-4.2** — *Given* the Voter ID locality differs from Aadhaar's and the citizen still lives at the Aadhaar address, *then* the Voter ID gets an **address update due** (`M02-EX-address`).
- **M02-AC-4.3** — *Given* the citizen no longer lives at the address on their documents, *then* every held document that shows an address gets an address update due, and the plan puts Aadhaar first (`M02-EX-moved`).

### US5 — One ordered plan *(must)*

- **M02-AC-5.1** — *Given* issues on several documents, *when* the plan is built, *then* actions are ordered by the content-defined priority (mobile link → Aadhaar → PAN → Voter ID), as in `M02-EX-irfan`.
- **M02-AC-5.2** — *Given* two fields on the same document need the same correction (e.g. PAN name and DOB), *then* the plan has **one** action covering both fields, while each field still counts as its own issue (`M02-EX-grouped`).

### US6 — Private by construction *(must)*

- **M02-AC-6.1** — *Given* the same input, *when* the detector runs twice, *then* it returns identical output and performs no input/output of its own (pure function).

## 4. Functional requirements

- **M02-FR-01** — The detector MUST be a pure, deterministic function in `packages/rules` that runs in the browser (ADR-002). It receives the citizen's answers and the content bundle (F02) and returns a report.
- **M02-FR-02** — Documents in scope at P1: Aadhaar, PAN, Voter ID (EPIC). Fields: name, date of birth, gender, address locality. Gender and address are compared only on Aadhaar and Voter ID (PAN cards print neither).
- **M02-FR-03** — **Reference document** *(Q-02 default)*: Aadhaar; if not held, PAN; otherwise Voter ID. Differences are attributed to the non-reference document.
- **M02-FR-04** — **Name normalisation**: Unicode NFKC; lower case; punctuation (`. , ' ’ - _ /`) treated as spaces; spaces collapsed; leading honorifics removed (`mr, mrs, ms, miss, shri, sri, smt, kum, kumari, dr`).
- **M02-FR-05** — **Name classification** *(Q-03 default)*. After normalisation:
  - identical → **match** (no issue);
  - identical once spaces are removed → **variant**, reason `spacing`;
  - same number of words, each pair related → **variant**, with the strongest reason among `initials` (single letter vs full word) > `abbreviation` (e.g. Mohd./Md. → Mohammed) > `transliteration` (e.g. Muhammad / Mohammed);
  - same words in a different order (allowing the relations above) → **variant**, reason `word_order`;
  - different number of words → **different**, reason `missing_or_extra_part`;
  - otherwise → **different**, reason `different_name`.

  Both **variant** and **different** raise a **mismatch** issue, because both fail KYC and PAN–Aadhaar linking; the explanation for a variant is gentler.
- **M02-FR-06** — Abbreviations and transliteration groups come from the content bundle's **name-variant dictionary** (F02), not from code, so the content team can extend it from help-desk evidence.
- **M02-FR-07** — **Date of birth**: a full date is day-month-year; a year-only date has just the year.
  - full vs full, different → mismatch `date_differs` on the non-reference document;
  - any document showing only the year → update due `year_only` on that document;
  - year-only vs anything with a different year → mismatch `year_differs` on the non-reference document.
- **M02-FR-08** — **Gender** differs → mismatch `gender_differs` on the non-reference document.
- **M02-FR-09** — **Address**: localities compared after normalisation, ignoring spaces. If the citizen answers that they **no longer live** at the address on their documents → update due `moved` on every held document that shows an address (Aadhaar, Voter ID). Otherwise, a locality differing from the reference → update due `address_differs`.
- **M02-FR-10** — **Aadhaar answers** (only when Aadhaar is held): mobile not linked → update due `mobile_not_linked` (field `mobile_link`); documents not updated in 10+ years → update due `documents_not_updated_10y` (field `documents`). "Not sure" raises no issue but adds a **tip** (`check_mobile_link`, `check_document_update`, `check_address`).
- **M02-FR-11** — **Field results**: for every field and held document the report gives `ok`, `mismatch`, `update_due` or `na`.
- **M02-FR-12** — **Document status**: `mismatch` if the document has any mismatch issue; else `update_due` if it has any update-due issue; else `valid`.
- **M02-FR-13** — **Action plan**: each issue maps to the content action whose `document` matches and whose `fields` include the issue's field. Actions are de-duplicated (one action, many fields) and sorted by the action's `priority`, then id.

## 5. Executable examples

All examples use the same input shape. Dates are `DD-MM-YYYY`, or `YYYY` for year-only. Answers are `yes`, `no` or `unsure` (default `yes`).

```yaml
id: M02-EX-irfan
source: DPR §06 worked example
input:
  documents:
    aadhaar:  { name: "Mohammed Irfan", dob: "12-06-1990", gender: male, locality: "Shivajinagar" }
    pan:      { name: "Mohd. Irfan",    dob: "12-06-1990" }
    voter_id: { name: "Mohammed Irfan", dob: "01-01-1990", gender: male, locality: "Shivajinagar" }
  answers: { mobileLinked: "no", documentsUpdatedWithin10Years: "yes", livesAtDocumentAddress: "yes" }
expect:
  reference: aadhaar
  fieldResults:
    name:    { aadhaar: ok, pan: mismatch, voter_id: ok }
    dob:     { aadhaar: ok, pan: ok,       voter_id: mismatch }
    gender:  { aadhaar: ok, pan: na,       voter_id: ok }
    address: { aadhaar: ok, pan: na,       voter_id: ok }
    mobile_link: { aadhaar: update_due }
  issues:
    - { document: pan,      field: name,        kind: mismatch,   reason: abbreviation }
    - { document: voter_id, field: dob,         kind: mismatch,   reason: date_differs }
    - { document: aadhaar,  field: mobile_link, kind: update_due, reason: mobile_not_linked }
  documentStatus: { aadhaar: update_due, pan: mismatch, voter_id: mismatch }
  actions: [aadhaar-link-mobile, pan-correction, voter-correction]
```

```yaml
id: M02-EX-names
cases:
  - { a: "Mohammed Irfan", b: "MOHAMMED  IRFAN",  expect: match }
  - { a: "Mohammed Irfan", b: "Mohammed Irfan.",  expect: match }
  - { a: "Mr. Mohammed Irfan", b: "Mohammed Irfan", expect: match }
  - { a: "Mohammed Irfan", b: "Mohd. Irfan",      expect: variant, reason: abbreviation }
  - { a: "Mohammed Irfan", b: "Md Irfan",         expect: variant, reason: abbreviation }
  - { a: "Mohammed Irfan", b: "Muhammad Irfan",   expect: variant, reason: transliteration }
  - { a: "Fatima Shaikh",  b: "Fathima Sheikh",   expect: variant, reason: transliteration }
  - { a: "Ayesha Khan",    b: "Aisha Khan",       expect: variant, reason: transliteration }
  - { a: "Ravi Kumar",     b: "Ravi Kr.",         expect: variant, reason: abbreviation }
  - { a: "Mohammed Irfan", b: "M. Irfan",         expect: variant, reason: initials }
  - { a: "Mohammed Irfan", b: "Irfan Mohammed",   expect: variant, reason: word_order }
  - { a: "Mohammed Irfan", b: "Irfan M.",         expect: variant, reason: word_order }
  - { a: "Mohammed Irfan", b: "MohammedIrfan",    expect: variant, reason: spacing }
  - { a: "Fatima Shaikh",  b: "Fatima Ansari",    expect: different, reason: different_name }
  - { a: "Mohammed Irfan Khan", b: "Mohammed Irfan", expect: different, reason: missing_or_extra_part }
```

```yaml
id: M02-EX-reference
cases:
  - held: [aadhaar, pan, voter_id]
    reference: aadhaar
  - held: [pan, voter_id]
    reference: pan
  - held: [voter_id]
    reference: voter_id
```

```yaml
id: M02-EX-dob
cases:
  - name: same full dates
    documents: { aadhaar: { dob: "12-06-1990" }, pan: { dob: "12-06-1990" } }
    issues: []
  - name: full dates differ
    documents: { aadhaar: { dob: "12-06-1990" }, voter_id: { dob: "01-01-1990" } }
    issues:
      - { document: voter_id, field: dob, kind: mismatch, reason: date_differs }
  - name: Ravi — Aadhaar shows only the year
    documents: { aadhaar: { dob: "1974" }, pan: { dob: "15-08-1974" } }
    issues:
      - { document: aadhaar, field: dob, kind: update_due, reason: year_only }
  - name: year-only with a different year
    documents: { aadhaar: { dob: "1974" }, pan: { dob: "15-08-1975" } }
    issues:
      - { document: aadhaar, field: dob, kind: update_due, reason: year_only }
      - { document: pan,     field: dob, kind: mismatch,   reason: year_differs }
  - name: date not entered on one card
    documents: { aadhaar: { dob: "12-06-1990" }, pan: {} }
    issues: []
```

```yaml
id: M02-EX-gender
documents:
  aadhaar:  { gender: female }
  voter_id: { gender: male }
issues:
  - { document: voter_id, field: gender, kind: mismatch, reason: gender_differs }
```

```yaml
id: M02-EX-address
cases:
  - name: Voter ID shows an older locality (Fatima)
    documents: { aadhaar: { locality: "Shivajinagar" }, voter_id: { locality: "Frazer Town" } }
    answers: { livesAtDocumentAddress: "yes" }
    issues:
      - { document: voter_id, field: address, kind: update_due, reason: address_differs }
    actions: [voter-shifting]
  - name: spacing differences are ignored
    documents: { aadhaar: { locality: "Shivaji Nagar" }, voter_id: { locality: "Shivajinagar" } }
    answers: { livesAtDocumentAddress: "yes" }
    issues: []
    actions: []
```

```yaml
id: M02-EX-moved
source: Persona Suresh — moved to Bengaluru
documents:
  aadhaar:  { locality: "Kalaburagi" }
  pan:      {}
  voter_id: { locality: "Kalaburagi" }
answers: { livesAtDocumentAddress: "no" }
issues:
  - { document: aadhaar,  field: address, kind: update_due, reason: moved }
  - { document: voter_id, field: address, kind: update_due, reason: moved }
actions: [aadhaar-demographic-update, voter-shifting]
```

```yaml
id: M02-EX-grouped
documents:
  aadhaar: { name: "Fatima Shaikh", dob: "03-03-1992" }
  pan:     { name: "Fatima Ansari", dob: "03-03-1993" }
issues:
  - { document: pan, field: name, kind: mismatch, reason: different_name }
  - { document: pan, field: dob,  kind: mismatch, reason: date_differs }
actions: [pan-correction]
actionFields:
  pan-correction: [name, dob]
```

```yaml
id: M02-EX-unsure
documents:
  aadhaar: { name: "Haji Yusuf" }
answers: { mobileLinked: "unsure", documentsUpdatedWithin10Years: "unsure", livesAtDocumentAddress: "unsure" }
issues: []
tips: [check_mobile_link, check_document_update, check_address]
```

## 6. Data and privacy

| Data item | Purpose | Consent / basis | Stored where | Who can see it | Retention | Deleted or anonymised by |
|---|---|---|---|---|---|---|
| Names, dates of birth, gender, locality as typed from each card | Compare documents | None needed — never leaves the device (C-04) | Browser memory; device storage only if the citizen chose to save (M01) | The person holding the device | `device_only` | Citizen ("Clear my data") or never saved |

- **No Aadhaar number, PAN number or EPIC number is ever asked for** (C-03).
- Audit events: none — nothing reaches the server.

## 7. Language, accessibility and assisted mode

- Reason explanations exist in en, kn, hi, ur (M02-AC-2.2). Names are compared as typed in English letters, as printed on the English side of each card.
- Results are shown with colour + icon + word (C-09).
- Assisted mode: the volunteer reads the explanation aloud; nothing changes in the logic.

## 8. Non-functional requirements

- Runs in under 50 ms on the budget-phone profile for P1 inputs.

## 9. Content dependencies

- Actions with `document`, `fields` and `priority` for: `aadhaar-link-mobile`, `aadhaar-demographic-update`, `aadhaar-document-update`, `pan-correction`, `voter-correction`, `voter-shifting` (D01–D03, ordering from D04).
- Name-variant dictionary seeded with the groups used in the examples; extended from the Phase 0 help-desk sample.

## 10. Edge cases and failure modes

- Names typed in Kannada, Devanagari or Urdu script are compared as typed and will usually be `different` — the form asks for the English spelling on the card.
- A citizen who has only one document still gets Aadhaar answer checks and year-only checks.
- Placeholder dates such as 01-01-YYYY on old Voter IDs (DPR example) are treated as a normal mismatch.

## 11. Out of scope

- Comparing documents other than Aadhaar, PAN and Voter ID (D05+).
- Optical reading of card images.
- Father's name, photo and signature checks.

## 12. Success measures

Share of pilot cases whose action plan the volunteer agreed with without changes (O01).

## 13. Open questions

| ID | Question | Proposed default | Blocking? |
|---|---|---|---|
| Q-02 | Reference document | Aadhaar, then PAN, then Voter ID | No (applied) |
| Q-03 | Which name differences count | As M02-FR-05 | No (applied; confirm with help-desk sample) |

## 14. Gate 1 checklist — spec ready

- [x] Stories prioritised; each independently testable
- [x] Acceptance scenarios with IDs
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
| 0.2 | 2026-10-04 | Full draft with executable examples; built ahead of approval | *Pending* |
