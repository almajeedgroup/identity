# M01 · Health Check

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P1 |
| **Spec owner** | Product owner + UI/UX designer |
| **Approvers** | Product owner · Privacy & grievance officer |
| **DPR trace** | §01 ("Checks"), §05, §06 (journey step 01), §07 (Home & Health Score screen), §09 (data lifecycle "Collect") |
| **Depends on** | [M02](../M02-mismatch-detector/spec.md), [F02](../F02-content-model/spec.md), [F03](../F03-design-system/spec.md), [F04](../F04-i18n/spec.md), D01–D03 |
| **Version** | 0.3 |

> **Approval note.** Built ahead of approval at the product sponsor's request. Proposed defaults for Q-01 (score), Q-04 (device-only results) and Q-05 (shared devices) are applied.

## 1. Summary

Most citizens do not know their documents disagree until a bank, school or pension office rejects them. The Health Check is a guided check of about **3 minutes** that asks for the key details printed on each card, compares them (M02), gives a **health score out of 100**, lists the issues, and ends with one clear next step. It needs no account and **nothing the citizen types leaves their phone** (C-04).

## 2. Users and scenarios

- Any citizen on their own phone, in their language.
- A volunteer and a citizen together on a **help-desk tablet** (assisted mode), or a family member helping on a shared phone.

## 3. User stories

### US1 — Check without signing up, privately *(must)*

As a citizen, I want to check my documents without creating an account and without my details being sent anywhere, so that I can trust the app.

- **M01-AC-1.1** — *Given* a citizen who is not logged in, *when* they choose their documents, enter the details and finish, *then* they see a health score and their issues.
- **M01-AC-1.2** — *Given* the citizen types their details, *when* the check runs and the results are shown, *then* no network request carries any value they typed.
- **M01-AC-1.3** — *Given* the citizen says this is **not their own phone**, *when* they finish and leave, *then* nothing is saved on the device.
- **M01-AC-1.4** — *Given* a check is saved on the device, *when* the citizen taps "Clear my data", *then* the saved check is removed.

### US2 — Understand my result *(must)*

- **M01-AC-2.1** — *Given* the examples in `M01-EX-scores`, *when* scored, *then* the score and band are as listed.
- **M01-AC-2.2** — *Given* results, *when* shown, *then* each document has a status (Valid, Update due or Mismatch) shown as **icon + word**, not colour alone.
- **M01-AC-2.3** — *Given* results with two or more documents, *when* shown, *then* a mismatch report lists, for each field, what each card says and the result.

### US3 — Know what to do next *(must)*

- **M01-AC-3.1** — *Given* issues, *when* the action plan is shown, *then* each step shows the form, where to go, the fee with its "as of" date or "free", whether the information has been verified, and an official link.
- **M01-AC-3.2** — *Given* issues, *when* the results screen is shown, *then* there is exactly **one primary action** ("Fix N issues") and a secondary "Book assisted help".
- **M01-AC-3.3** — *Given* no issues, *when* the results screen is shown, *then* it says all documents are valid and does not show a "Fix" action.

### US4 — In my language, accessible *(must)*

- **M01-AC-4.1** — *Given* the citizen chose Urdu, *when* they complete the check, *then* every screen is in Urdu with a right-to-left layout.
- **M01-AC-4.2** — *Given* the start, question and results screens, *when* checked with automated accessibility rules, *then* there are no serious or critical violations.

### US5 — See my last check *(should)*

- **M01-AC-5.1** — *Given* a check was saved on this phone, *when* the citizen opens the home screen, *then* it shows the score, the number of issues and the date of the last check.

## 4. Functional requirements

### Flow

- **M01-FR-01** — Steps, each ending with one primary action:
  1. **Start** — "Is this your own phone?" (*Yes, keep my result on this phone* / *No, don't save anything*), and "Which documents do you have?" (Aadhaar, PAN, Voter ID; at least one).
  2. **One step per selected document** — name as printed (English spelling), date of birth (day, month, year, or "only the year is printed"), and — for Aadhaar and Voter ID — gender and area/locality.
  3. **Your situation** — "Do you still live at the address on your documents?" (only if a held document shows an address); and, if Aadhaar is held, "Is a mobile number linked to your Aadhaar?" and "Have you updated your Aadhaar documents (proof of identity and address) in the last 10 years?" Each answer is Yes / No / Not sure; an unanswered question counts as Not sure — the app never assumes an answer.
  4. **Results**.
- **M01-FR-02** — Every field may be left blank; blanks are "not applicable" in the comparison (M02-AC-1.3). A progress indicator shows "Step N of M"; Back keeps answers.
- **M01-FR-03** — **Never ask** for an Aadhaar, PAN or EPIC number, an OTP, or a document photo (C-02, C-03).

### Scoring *(Q-01 default)*

- **M01-FR-04** — Score = 100 − 14 × (number of issues), never below 0. Each issue is one field on one document (M02).
- **M01-FR-05** — Bands: **100** → "All valid"; **70–99** → "Good"; **below 70** → "Needs attention". The label includes the issue count, e.g. "Good — 2 issues".

### Results

- **M01-FR-06** — Results show: score dial with band and issue count; one card per document with status; the mismatch report (if 2+ documents) laid out **one block per detail** — the detail, its result, then what each card says — as in the DPR §07 "Mismatch report" screen, so nothing scrolls sideways on a 360 px phone; tips for "Not sure" answers; the action plan from M02 with content from F02 (form, channel, fee resolved for today's date, verification status, official links); "Fix N issues" (moves to the plan); "Book assisted help"; "Clear my data".
- **M01-FR-07** — Every official link shows the official-link badge and the OTP warning "1dentity will never ask for your OTP, PIN or password" is visible on the results screen (C-02).

### Device storage *(Q-04, Q-05 defaults)*

- **M01-FR-08** — The start question defaults to **No — don't save anything** (privacy by default, C-04). If the citizen says it is their own phone, the **answers** (not the report) and the date are saved in the browser's storage on this device only; the report is recomputed on load. Otherwise nothing is written.
- **M01-FR-09** — "Clear my data" removes everything the Health Check saved.

## 5. Executable examples

Inputs use the M02 input shape.

```yaml
id: M01-EX-scores
cases:
  - name: Fatima — DPR §07 home screen
    documents:
      aadhaar:  { name: "Fatima Shaikh", dob: "03-03-1992", gender: female, locality: "Shivajinagar" }
      pan:      { name: "Fatima Ansari", dob: "03-03-1992" }
      voter_id: { name: "Fatima Shaikh", dob: "03-03-1992", gender: female, locality: "Frazer Town" }
    answers: { mobileLinked: "yes", documentsUpdatedWithin10Years: "yes", livesAtDocumentAddress: "yes" }
    expect: { score: 72, band: good, issueCount: 2, documentStatus: { aadhaar: valid, pan: mismatch, voter_id: update_due } }
  - name: Irfan — DPR §06 worked example
    documents:
      aadhaar:  { name: "Mohammed Irfan", dob: "12-06-1990", gender: male, locality: "Shivajinagar" }
      pan:      { name: "Mohd. Irfan",    dob: "12-06-1990" }
      voter_id: { name: "Mohammed Irfan", dob: "01-01-1990", gender: male, locality: "Shivajinagar" }
    answers: { mobileLinked: "no", documentsUpdatedWithin10Years: "yes", livesAtDocumentAddress: "yes" }
    expect: { score: 58, band: needs_attention, issueCount: 3 }
  - name: Irfan after all three fixes — DPR "58 → 100"
    documents:
      aadhaar:  { name: "Mohammed Irfan", dob: "12-06-1990", gender: male, locality: "Shivajinagar" }
      pan:      { name: "Mohammed Irfan", dob: "12-06-1990" }
      voter_id: { name: "Mohammed Irfan", dob: "12-06-1990", gender: male, locality: "Shivajinagar" }
    answers: { mobileLinked: "yes", documentsUpdatedWithin10Years: "yes", livesAtDocumentAddress: "yes" }
    expect: { score: 100, band: all_valid, issueCount: 0, documentStatus: { aadhaar: valid, pan: valid, voter_id: valid } }
  - name: score never goes below zero
    documents:
      aadhaar:  { name: "Suresh N", dob: "1990", gender: male, locality: "Kalaburagi" }
      pan:      { name: "Ramesh N", dob: "05-05-1991" }
      voter_id: { name: "S Naik", dob: "05-05-1992", gender: female, locality: "Kalaburagi" }
    answers: { mobileLinked: "no", documentsUpdatedWithin10Years: "no", livesAtDocumentAddress: "no" }
    expect: { score: 0, band: needs_attention }
```

## 6. Data and privacy

| Data item | Purpose | Consent / basis | Stored where | Who can see it | Retention | Deleted or anonymised by |
|---|---|---|---|---|---|---|
| Answers typed from each card | Run the check | None needed — never sent to the server (C-04) | Browser memory; browser storage **only** if "own phone" | The person holding the device | `device_only`, until cleared | Citizen ("Clear my data"); never saved on shared devices |
| Date of last check | Show "Last check" on home | As above | Browser storage if "own phone" | As above | `device_only` | As above |
| Anonymous "check completed" count with issue types | KPI "Health Checks completed" (DPR §12) | No personal data | Analytics (F11) | Product owner (aggregate only) | Per F11 | — *(not built in this version; F11 in S4)* |

- No identifiers, card numbers, OTPs or images are ever requested (C-02, C-03).
- Opening a case from a Health Check (carrying details over with consent) is part of M04, not this spec.

## 7. Language, accessibility and assisted mode

- All screens in en, kn, hi, ur; Urdu right-to-left (F04).
- Labels on every input; grouped questions use fieldset and legend; errors announced; 48 px touch targets; large-text mode (F03).
- Status is colour + icon + word (C-09). The score is announced as "Health score 72 out of 100".
- **Assisted mode:** on a help-desk tablet the volunteer chooses "No, don't save anything" at the start; the volunteer can read every question aloud; "Book assisted help" is always visible on results.

## 8. Non-functional requirements

- Completes in about 3 minutes for three documents (pilot-measured, O01).
- Works offline once the app has loaded (full offline caching arrives with F09 in S2).

## 9. Content dependencies

D01–D03 action content and the name-variant dictionary (F02) in four languages.

## 10. Edge cases and failure modes

- No documents selected → cannot continue; message explains.
- Only one document → no mismatch report; Aadhaar and year-only checks still apply.
- Browser storage unavailable (private mode) → check still works; it just isn't saved.
- Saved answers from an older version that cannot be read → discarded silently.

## 11. Out of scope

- Opening a case and booking (M04, M05 — S3). "Book assisted help" links to the help page until then.
- Family members (M07, P2).
- Analytics events (F11, S4).

## 12. Success measures

Median time to complete ≤ 3 minutes; completion rate; share of completed checks that lead to a guide or a case (pilot).

## 13. Open questions

| ID | Question | Proposed default | Blocking? |
|---|---|---|---|
| Q-01 | Score model and bands | As M01-FR-04/05 | No (applied) |
| Q-04 | Where results are kept | Device only, own phone only | No (applied) |
| Q-05 | Shared and assisted devices | "Is this your own phone?" at start | No (applied) |

## 14. Gate 1 checklist — spec ready

- [x] Stories prioritised; each independently testable
- [x] Acceptance scenarios with IDs
- [x] Executable examples for every rule or calculation
- [ ] Data and privacy table signed off by the privacy officer *(not yet appointed)*
- [x] Languages, accessibility and assisted mode described
- [x] Content dependencies listed
- [x] Out of scope explicit
- [x] No blocking `[NEEDS CLARIFICATION]` remains

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-04 | Seed in `backlog.md` | — |
| 0.2 | 2026-10-04 | Full draft; built ahead of approval | *Pending* |
| 0.3 | 2026-10-04 | As-built: "own phone" defaults to No; mismatch report shown per detail instead of a wide table (failed the 360 px check); unanswered questions count as "Not sure" | *Pending* |
