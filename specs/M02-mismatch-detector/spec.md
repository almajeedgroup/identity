# M02 · Mismatch Detector

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P1 |
| **Spec owner** | Product owner + tech lead |
| **Approvers** | Product owner · Privacy & grievance officer |
| **DPR trace** | §01 ("Compares"), §03 (impact hotspots), §05, §06 (worked example) · **PRD** §6, §11, §12, §13, §21, §28 |
| **Depends on** | [F01](../F01-domain-model/spec.md), [F02](../F02-content-model/spec.md), D01–D04 |
| **Version** | 1.0 |

> **Approval note.** Built ahead of approval at the product sponsor's request. Proposed defaults for Q-02 (reference document) and Q-03 (name variants) are applied and marked below.

## 1. Summary

Small differences between documents — "Mohd." on PAN but "Mohammed" on Aadhaar, a different date of birth on the Voter ID, an old address — block bank KYC, scholarships, pensions and PAN–Aadhaar linking (DPR §02, §03). The Mismatch Detector compares the details a citizen enters from each card, explains every difference in plain language, and produces an **ordered action plan**. It runs entirely on the citizen's device (C-04).

## 2. Users and scenarios

- **Fatima** (PAN still shows her maiden surname), **Ravi** (Aadhaar shows only his birth year), **Ayesha** (name spelt differently), **Suresh** (moved to Bengaluru) — DPR §03.
- Used inside the Health Check (M01), on the citizen's phone or on a help-desk tablet with a volunteer.

## 3. User stories

This spec has two parts. **Part A** (US1–US6) is the Quick Check comparison used on the device by M01. **Part B** (US7–US12) is the Full Check consistency engine required by the Developer PRD: normalisation, six comparison statuses, any number of documents and fields, and the consistency report. Both share the name normaliser and the name-variant dictionary.

**Part A — Quick Check**

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

**Part B — Full Check consistency engine (PRD §11–§13)**

### US7 — Harmless formatting is not reported as a discrepancy *(must)*

As a citizen, I want case, punctuation and date-format differences treated as harmless, so that I only worry about real differences.

- **M02-AC-7.1** — *Given* each pair in `M02-EX-statuses`, *when* compared, *then* the status and reason are as listed — including the PRD §11 examples (MOHAMMED IBRAHIM vs Mohammed Ibrahim → formatting variation; 12/04/2002 vs 12-04-2002 → formatting variation; Bengaluru vs Bangalore → likely equivalent; Mohamad vs Mohammed Ibrahim → potential discrepancy; Mohammed Ibrahim vs Ibrahim Ahmed → major discrepancy).
- **M02-AC-7.2** — *Given* any two names, *when* they are not equal after safe normalisation, *then* the result is never better than "potential discrepancy" — similar-looking names are never declared equivalent (C-18).

### US8 — Every field, every document *(must)*

- **M02-AC-8.1** — *Given* documents of any of the 11 PRD types, *when* analysed, *then* each compared field (name, date of birth, gender, father's, mother's and spouse's names, place of birth, address) is compared across every document that prints it, and a field a document prints but has no value for is reported as **missing**.
- **M02-AC-8.2** — *Given* a Voter ID, Driving Licence, caste or income certificate with a relative's name and relation, *when* analysed, *then* the name is compared as the father's, mother's or spouse's name according to the relation, and a relation of "other" is not compared.

### US9 — Dates and places with care *(must)*

- **M02-AC-9.1** — *Given* the date cases in `M02-EX-statuses`, *then* a year-only date, swapped day and month, and a 1 January placeholder are each flagged for review, and other differences are major.
- **M02-AC-9.2** — *Given* addresses in `M02-EX-address-full`, *then* different PIN or city is major, a different house/street line is a potential discrepancy, and less detail or abbreviations are likely equivalent.

### US10 — Measured against my target *(must)*

- **M02-AC-10.1** — *Given* a target value for a field (M16), *when* analysed, *then* each document's status is its comparison with the target; *given* no target, *then* the suggested target (M16) is used and the field is marked "target not confirmed".
- **M02-AC-10.2** — *Given* a citizen or staff override on a document field (accepted as equivalent, or flagged as needing correction) with a reason, *when* analysed, *then* the status reflects the override and is marked as overridden (C-17).

### US11 — A report anyone can read *(must)*

- **M02-AC-11.1** — *Given* `M02-EX-report`, *when* the report is built, *then* per field it gives the colour status, the number of variations, how many are formatting-only, the number of documents, the missing count, and the documents needing review, exactly as listed.
- **M02-AC-11.2** — *Given* a report, *when* issues are counted, *then* only potential and major discrepancies against the target count as issues; formatting variations, likely-equivalent values and missing values are informational (Q-29).

### US12 — Pure and fast *(must)*

- **M02-AC-12.1** — *Given* the same documents, targets and knowledge base, *when* analysed twice, *then* the result is identical and the inputs are unchanged.

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

### Part B — Full Check engine (`packages/engine`)

- **M02-FR-14** — **Statuses** (PRD §12), from best to worst: `exact_match` (identical as written) · `formatting_variation` (equal after safe normalisation) · `likely_equivalent` (a known non-material variation: renamed place, abbreviation in an address, less detail) · `potential_discrepancy` (needs review) · `major_discrepancy` (substantially different) · `missing` (the document prints the field but has no value; informational, reported separately).
- **M02-FR-15** — **Colours** (F03 v0.3): exact match and formatting variation → green · likely equivalent → yellow · potential → orange · major → red · missing → grey. Always with icon and word.
- **M02-FR-16** — **Names** (name, father's, mother's, spouse's): identical → exact; equal after case, punctuation, spacing-around-punctuation and leading-honorific normalisation → formatting variation; spacing, initials, abbreviations, transliterations, word order, or one name containing all of the other's parts → potential discrepancy; anything else → major. **Never** likely equivalent (C-18).
- **M02-FR-17** — **Dates** are read in Indian day-first order from `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`, `YYYY-MM-DD`, `D Mon YYYY`, `DD-MON-YYYY` or `YYYY`. Identical → exact; same date in a different format → formatting variation; year-only vs a full date in that year → potential (`year_only`); day and month swapped → potential (`day_month_swapped`); 1 January vs another date in the same year → potential (`placeholder_date`); unreadable → potential (`unreadable_date`); otherwise → major (`date_differs`).
- **M02-FR-18** — **Gender**: M/Male, F/Female, T/Transgender/Third gender are the same values in different formats → formatting variation; different → major.
- **M02-FR-19** — **Place of birth**: words are mapped through the **place-variant dictionary** (content, F02: officially renamed places such as Bangalore → Bengaluru). Same after mapping → likely equivalent (`place_renamed`) or formatting; one contains the other → potential (`place_partial`); otherwise major (`place_differs`).
- **M02-FR-20** — **Address** is `line` (house, building, street, locality), `city`, `pin` (and optional district, state). Different PIN or different city (after place mapping) → major (`address_city_or_pin_differs`); different line → potential (`address_line_differs`); line abbreviations expanded from the **address-abbreviation dictionary** (content) or renamed city → likely equivalent (`address_abbreviation`); one address less detailed than the other → likely equivalent (`address_less_detail`); otherwise formatting or exact.
- **M02-FR-21** — **Relative names** on Voter ID, Driving Licence, caste and income certificates carry a relation (`father`, `mother`, `husband`, `wife`, `other`) and are compared as `father_name`, `mother_name` or `spouse_name`; `other` is shown but not compared (C-17: relationship differences are reported, never ruled invalid).
- **M02-FR-22** — **Field analysis**: for each field, the documents that print it are listed; *variations* are distinct values as written; *formatting-only* variations are those equal to another after safe normalisation; each document's status is its comparison with the target (confirmed, or suggested by M16); the field's colour is its worst document status (missing excluded).
- **M02-FR-23** — **Overrides** (C-17): an override `accepted_equivalent` turns a potential discrepancy into likely equivalent; `requires_correction` raises any status to at least potential discrepancy. Overrides of major discrepancies to equivalent are allowed only with a reason and are always shown as overridden. The engine records which results were overridden; who and why is stored by M16.
- **M02-FR-24** — **Issues** (Q-29): document fields with potential or major status against the target. The report lists *documents requiring review* in order of tier (M18) and the total issue count.

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

### Part B examples

```yaml
id: M02-EX-statuses
source: PRD §11 examples, plus date, gender and place cases
cases:
  - { field: name, a: "MOHAMMED IBRAHIM", b: "Mohammed Ibrahim", status: formatting_variation, reason: case_or_punctuation }
  - { field: name, a: "Mohammed Ibrahim", b: "Mohammed Ibrahim", status: exact_match }
  - { field: name, a: "Mr. Mohammed Ibrahim", b: "Mohammed Ibrahim", status: formatting_variation, reason: honorific }
  - { field: name, a: "Mohamad Ibrahim", b: "Mohammed Ibrahim", status: potential_discrepancy, reason: transliteration }
  - { field: name, a: "Mohd Ibrahim", b: "Mohammed Ibrahim", status: potential_discrepancy, reason: abbreviation }
  - { field: name, a: "M. Ibrahim", b: "Mohammed Ibrahim", status: potential_discrepancy, reason: initials }
  - { field: name, a: "Ibrahim Mohammed", b: "Mohammed Ibrahim", status: potential_discrepancy, reason: word_order }
  - { field: name, a: "MohammedIbrahim", b: "Mohammed Ibrahim", status: potential_discrepancy, reason: spacing }
  - { field: name, a: "Mohammed Ibrahim Khan", b: "Mohammed Ibrahim", status: potential_discrepancy, reason: missing_or_extra_part }
  - { field: name, a: "Mohammed Ibrahim", b: "Ibrahim Ahmed", status: major_discrepancy, reason: different_name }
  - { field: name, a: "Ravi Kumar", b: "Suresh Babu Naik", status: major_discrepancy, reason: different_name }
  - { field: father_name, a: "Abdul Rahim", b: "Abdul Raheem", status: potential_discrepancy, reason: transliteration }
  - { field: dob, a: "12/04/2002", b: "12-04-2002", status: formatting_variation, reason: format_only }
  - { field: dob, a: "12 APR 2002", b: "2002-04-12", status: formatting_variation, reason: format_only }
  - { field: dob, a: "12/04/2002", b: "12/04/2002", status: exact_match }
  - { field: dob, a: "2002", b: "12/04/2002", status: potential_discrepancy, reason: year_only }
  - { field: dob, a: "04/12/2002", b: "12/04/2002", status: potential_discrepancy, reason: day_month_swapped }
  - { field: dob, a: "01/01/2002", b: "12/04/2002", status: potential_discrepancy, reason: placeholder_date }
  - { field: dob, a: "13/04/2002", b: "12/04/2002", status: major_discrepancy, reason: date_differs }
  - { field: dob, a: "12/04/2003", b: "12/04/2002", status: major_discrepancy, reason: date_differs }
  - { field: dob, a: "around 2002", b: "12/04/2002", status: potential_discrepancy, reason: unreadable_date }
  - { field: gender, a: "M", b: "Male", status: formatting_variation, reason: gender_format }
  - { field: gender, a: "Female", b: "Male", status: major_discrepancy, reason: gender_differs }
  - { field: place_of_birth, a: "Bengaluru", b: "Bangalore", status: likely_equivalent, reason: place_renamed }
  - { field: place_of_birth, a: "BANGALORE", b: "Bangalore", status: formatting_variation, reason: case_or_punctuation }
  - { field: place_of_birth, a: "Shivajinagar, Bengaluru", b: "Bengaluru", status: potential_discrepancy, reason: place_partial }
  - { field: place_of_birth, a: "Mysuru", b: "Bengaluru", status: major_discrepancy, reason: place_differs }
```

```yaml
id: M02-EX-address-full
cases:
  - name: identical
    a: { line: "12, 3rd Cross, Shivajinagar", city: "Bengaluru", pin: "560051" }
    b: { line: "12, 3rd Cross, Shivajinagar", city: "Bengaluru", pin: "560051" }
    status: exact_match
  - name: case and punctuation only
    a: { line: "12 3RD CROSS SHIVAJINAGAR", city: "BENGALURU", pin: "560051" }
    b: { line: "12, 3rd Cross, Shivajinagar", city: "Bengaluru", pin: "560051" }
    status: formatting_variation
    reason: case_or_punctuation
  - name: renamed city
    a: { line: "12, 3rd Cross, Shivajinagar", city: "Bangalore", pin: "560051" }
    b: { line: "12, 3rd Cross, Shivajinagar", city: "Bengaluru", pin: "560051" }
    status: likely_equivalent
    reason: address_abbreviation
  - name: abbreviations in the line
    a: { line: "No. 12, 3rd Crs, Shivajinagar Main Rd", city: "Bengaluru", pin: "560051" }
    b: { line: "12, 3rd Cross, Shivajinagar Main Road", city: "Bengaluru", pin: "560051" }
    status: likely_equivalent
    reason: address_abbreviation
  - name: less detail
    a: { line: "Shivajinagar", city: "Bengaluru", pin: "560051" }
    b: { line: "12, 3rd Cross, Shivajinagar", city: "Bengaluru", pin: "560051" }
    status: likely_equivalent
    reason: address_less_detail
  - name: different house
    a: { line: "45, 5th Main, Shivajinagar", city: "Bengaluru", pin: "560051" }
    b: { line: "12, 3rd Cross, Shivajinagar", city: "Bengaluru", pin: "560051" }
    status: potential_discrepancy
    reason: address_line_differs
  - name: different PIN
    a: { line: "12, 3rd Cross, Shivajinagar", city: "Bengaluru", pin: "560001" }
    b: { line: "12, 3rd Cross, Shivajinagar", city: "Bengaluru", pin: "560051" }
    status: major_discrepancy
    reason: address_city_or_pin_differs
  - name: moved to another city
    a: { line: "8, Station Road", city: "Kalaburagi", pin: "585101" }
    b: { line: "12, 3rd Cross, Shivajinagar", city: "Bengaluru", pin: "560051" }
    status: major_discrepancy
    reason: address_city_or_pin_differs
```

```yaml
id: M02-EX-relatives
documents:
  - { id: pan,   kind: pan,      fields: { father_name: "Abdul Raheem" } }
  - { id: voter, kind: voter_id, fields: { relative_name: "Abdul Rahim", relative_type: father } }
  - { id: dl,    kind: driving_licence, fields: { relative_name: "Fatima Begum", relative_type: other } }
expect:
  father_name: { pan: exact_match, voter: potential_discrepancy }
  notCompared: [dl]
```

```yaml
id: M02-EX-report
source: PRD §13 and §30 — six documents, one person
documents:
  - { id: birth,    kind: birth_certificate, fields: { name: "Mohamad Ibrahim",  dob: "12-04-2002",  father_name: "Abdul Raheem", mother_name: "Ayesha Banu" } }
  - { id: sslc,     kind: sslc,              fields: { name: "Mohammed Ibrahim", dob: "12/04/2002",  father_name: "Abdul Rahim",  mother_name: "Ayesha Banu" } }
  - { id: aadhaar,  kind: aadhaar,           fields: { name: "MOHAMMED IBRAHIM", dob: "12/04/2002",  gender: "Male" } }
  - { id: pan,      kind: pan,               fields: { name: "Ibrahim Mujeeb",   dob: "12/04/2002",  father_name: "ABDUL RAHEEM" } }
  - { id: passport, kind: passport,          fields: { name: "Mohammed Ibrahim", dob: "12 APR 2002", gender: "M", father_name: "Abdul Raheem", mother_name: "Ayesha Banu" } }
  - { id: voter,    kind: voter_id,          fields: { name: "Mohd Ibrahim",     dob: "12-04-2002",  gender: "Male" } }
expect:
  fields:
    name:        { colour: red,    variations: 5, formattingOnly: 1, documents: 6, missing: 0, target: "Mohammed Ibrahim", review: [birth, pan, voter] }
    dob:         { colour: green,  variations: 3, formattingOnly: 2, documents: 6, missing: 0, review: [] }
    father_name: { colour: orange, variations: 3, formattingOnly: 1, documents: 4, missing: 0, target: "Abdul Raheem", review: [sslc] }
    mother_name: { colour: green,  variations: 1, formattingOnly: 0, documents: 3, missing: 0, review: [] }
    gender:      { colour: green,  variations: 2, formattingOnly: 1, documents: 3, missing: 1, review: [] }
  issueCount: 4
  documentsRequiringReview: [birth, sslc, pan, voter]
```

```yaml
id: M02-EX-overrides
source: Same documents as M02-EX-report
overrides:
  - { document: voter, field: name, decision: accepted_equivalent, reason: "Bank accepted 'Mohd' as the same name" }
  - { document: aadhaar, field: name, decision: requires_correction, reason: "Citizen wants title case on Aadhaar" }
expect:
  name: { voter: likely_equivalent, aadhaar: potential_discrepancy }
  overridden: [voter, aadhaar]
  issueCount: 4
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
| 1.0 | 2026-10-05 | Part B from the Developer PRD: normalisation, six statuses, 11 document types, relatives, places, addresses, targets, overrides, consistency report | *Pending* |
