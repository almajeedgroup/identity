# M18 · Correction roadmap and dependency engine

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P0 (PRD) |
| **Spec owner** | Product owner + tech lead |
| **Approvers** | Product owner · Content lead |
| **DPR trace** | §06 (action plan, official links only), §09 (facilitation, not impersonation) · **PRD** §5, §7 (steps 11–14), §14, §16, §17, §28, §30 |
| **Depends on** | [M02](../M02-mismatch-detector/spec.md) v1.0, [M16](../M16-citizen-profile/spec.md), [F02](../F02-content-model/spec.md) v0.3 |
| **Version** | 0.1 |

> **Approval note.** Specified from the Developer PRD and built ahead of approval (DEC-2). The engine is built in increment 2; the roadmap screens in increment 4.

## 1. Summary

Knowing *what* differs is not enough: citizens need to know *what to fix first*. The roadmap engine takes the issues found by M02, the citizen's targets (M16) and the rules knowledge base (F02), and produces an ordered **Document Correction Roadmap**. Foundational records come first, rule prerequisites are respected, and every step says **why it is in that place, which rule it follows, where that rule comes from and when it was last verified**. Where no verified procedure exists, the step names the authority and says so plainly — it never invents one (C-18). It is a recommendation engine, not a legal decision engine (PRD §14).

## 2. Users and scenarios

- A citizen with several discrepancies across civil, education and identity records (PRD §17).
- 1dentity staff preparing an assisted case (P1) from the same roadmap.

## 3. User stories

### US1 — A sensible order *(must)*

- **M18-AC-1.1** — *Given* the PRD §17 scenario (`M18-EX-prd-scenario`), *when* the roadmap is built, *then* the steps and their order are exactly as listed, with and without a confirmed target.
- **M18-AC-1.2** — *Given* two documents that need the same field corrected, *when* they are in different tiers, *then* the lower tier (more foundational) comes first, with reason `foundational_first`.
- **M18-AC-1.3** — *Given* a rule with a prerequisite that is also in the plan (`M18-EX-prerequisites`), *then* the prerequisite step comes first and the dependent step lists it.
- **M18-AC-1.4** — *Given* rules whose prerequisites form a cycle (`M18-EX-cycle`), *when* the roadmap is built, *then* it falls back to tier order and reports a `rule_cycle` warning naming the rules, for the rules admin to fix.

### US2 — Every step explains itself *(must)*

- **M18-AC-2.1** — *Given* any correction step, *when* shown, *then* it carries the reason for its position, the rule id and version, the official sources, and either the last-verified date or an explicit "not yet verified" (C-18).
- **M18-AC-2.2** — *Given* a document for which the knowledge base has no usable rule, *when* the step is built, *then* it names the responsible authority from the catalogue, is marked `no_verified_rule`, and contains **no** steps, fees, forms or links.

### US3 — Do it yourself, or ask 1dentity *(must)*

- **M18-AC-3.1** — *Given* a step with a rule, *when* shown, *then* the DIY path gives (where the rule has them): what is wrong, the target used, the authority, online/offline route, required documents and proofs, steps, official links, government fee, appointment, tracking and what to do if rejected.
- **M18-AC-3.2** — *Given* any step, *when* the assistance option is shown, *then* the 1dentity service fee (from admin pricing, or "to be confirmed" when none is set) is shown **separately** from the government fee and is never labelled as a government charge (C-01).

### US4 — The right rules for my state *(must)*

- **M18-AC-4.1** — *Given* rules at national, state and district level, *when* a citizen's jurisdiction is known, *then* the most specific matching rule is used and rules for other states are never used (`M18-EX-jurisdiction`).
- **M18-AC-4.2** — *Given* a rule outside its effective dates, or in `draft` or `withdrawn` status, *when* the roadmap is built, *then* it is not used (`M18-EX-jurisdiction`).

### US5 — Finish by checking again *(must)*

- **M18-AC-5.1** — *Given* a roadmap with at least one correction step, *then* its last step is "Re-run the consistency check"; *given* no issues, *then* the roadmap is empty and says the documents are consistent.

## 4. Functional requirements

- **M18-FR-01** — **Tiers** (PRD §14), from the document catalogue (F02): 1 civil (birth certificate) · 2 education (SSLC, PUC) · 3 identity/KYC (Aadhaar, PAN) · 4 passport and other identity (passport, Voter ID, driving licence) · 5 secondary (caste, income, ration card).
- **M18-FR-02** — **Rule selection**: for each document with issues, candidate rules match the document kind, cover at least one issue field, have status `published` or `in_review`, apply on the date, and match the jurisdiction (`IN` matches everyone; `IN-KA` matches Karnataka; `IN-KA-<district>` matches that district). The most specific jurisdiction wins; ties go to the lower `priority` number. `in_review` rules are shown as "not yet verified".
- **M18-FR-03** — **Steps**: one step per (document, rule); issues on the same document not covered by that rule produce another step (or a `no_verified_rule` step). A step lists its issues (field, status, value as written, target).
- **M18-FR-04** — **Ordering**: edges from (a) rule prerequisites present in the plan, and (b) for the same field, lower tier before higher tier. Topological sort; among ready steps, order by tier, then catalogue document order, then rule priority.
- **M18-FR-04a** — **Reason** for a step's position, first match wins: it waits for a prerequisite → `prerequisite` (with `dependsOn`); it waits for a more foundational record → `foundational_first` (with `dependsOn`); other steps wait for it as a prerequisite → `prerequisite_for_others`; other steps wait for it as the more foundational record → `foundational_first`; otherwise `independent`.
- **M18-FR-05** — **Cycles**: if the edges contain a cycle, drop the prerequisite edges in the cycle, order by tier, and add warning `rule_cycle` with the rule ids.
- **M18-FR-06** — **Leading step**: if any field with issues has no confirmed target, the roadmap starts with `confirm_targets` listing those fields (PRD §17, §30 step 2).
- **M18-FR-07** — **Closing step**: `recheck` ends every non-empty roadmap (PRD §30 step 7).
- **M18-FR-08** — **Fees**: government fees come only from the rule (resolved for the date, F02); the 1dentity service fee comes only from admin pricing (F02 `servicePrices`) and is labelled as such.
- **M18-FR-09** — **No time guarantees**: any processing time in a rule is shown as "usually", never as a promise (C-18).
- **M18-FR-10** — The engine is a pure function of (document analysis, targets, knowledge base, jurisdiction, date).

## 5. Executable examples

```yaml
id: M18-EX-prd-scenario
source: PRD §17
jurisdiction: IN-KA
asOf: "2026-11-02"
documents:
  - { id: birth,   kind: birth_certificate, fields: { name: "Mohamad Ibrahim" } }
  - { id: sslc,    kind: sslc,              fields: { name: "Mohammed Ibrahim" } }
  - { id: aadhaar, kind: aadhaar,           fields: { name: "Mohammed Ibrahim" } }
  - { id: pan,     kind: pan,               fields: { name: "Ibrahim Mujeeb" } }
withoutConfirmedTarget:
  steps:
    - { kind: confirm_targets, fields: [name] }
    - { kind: correction, document: birth, rule: null, verified: false, reason: foundational_first }
    - { kind: correction, document: pan, rule: pan-name-dob-correction, verified: false, reason: foundational_first, dependsOn: [birth] }
    - { kind: recheck }
withConfirmedTarget:
  targets: { name: "Mohammed Ibrahim" }
  steps:
    - { kind: correction, document: birth, rule: null, verified: false, reason: foundational_first }
    - { kind: correction, document: pan, rule: pan-name-dob-correction, verified: false, reason: foundational_first, dependsOn: [birth] }
    - { kind: recheck }
```

```yaml
id: M18-EX-prerequisites
jurisdiction: IN-KA
asOf: "2026-11-02"
targets: { name: "Mohammed Irfan", address: { line: "12, 3rd Cross, Shivajinagar", city: "Bengaluru", pin: "560051" } }
documents:
  - { id: pan,     kind: pan,      fields: { name: "M Irfan" } }
  - { id: aadhaar, kind: aadhaar,  fields: { name: "Mohd Irfan", address: { line: "8, Station Road", city: "Kalaburagi", pin: "585101" } } }
  - { id: voter,   kind: voter_id, fields: { name: "Mohammed Irfan", address: { line: "8, Station Road", city: "Kalaburagi", pin: "585101" } } }
steps:
  - { kind: correction, document: aadhaar, rule: aadhaar-demographic-update, reason: prerequisite_for_others }
  - { kind: correction, document: pan, rule: pan-name-dob-correction, reason: prerequisite, dependsOn: [aadhaar] }
  - { kind: correction, document: voter, rule: voter-form-8-shifting, reason: prerequisite, dependsOn: [aadhaar] }
  - { kind: recheck }
```

```yaml
id: M18-EX-jurisdiction
documents:
  - { id: dl, kind: driving_licence, fields: { name: "Ravi K" } }
targets: { name: "Ravi Kumar" }
asOf: "2026-11-02"
rules:
  - { id: dl-name-national,  jurisdiction: IN,        priority: 50, status: published }
  - { id: dl-name-karnataka, jurisdiction: IN-KA,     priority: 50, status: published }
  - { id: dl-name-blr,       jurisdiction: IN-KA-BLR, priority: 50, status: published, effectiveTo: "2026-10-01" }
  - { id: dl-name-mh,        jurisdiction: IN-MH,     priority: 50, status: published }
  - { id: dl-name-draft-ka,  jurisdiction: IN-KA,     priority: 10, status: draft }
cases:
  - { jurisdiction: IN-KA-BLR, rule: dl-name-karnataka }
  - { jurisdiction: IN-KA,     rule: dl-name-karnataka }
  - { jurisdiction: IN-MH,     rule: dl-name-mh }
  - { jurisdiction: IN-TN,     rule: dl-name-national }
```

```yaml
id: M18-EX-cycle
documents:
  - { id: pan,     kind: pan,     fields: { name: "M Irfan" } }
  - { id: aadhaar, kind: aadhaar, fields: { name: "Mohd Irfan" } }
targets: { name: "Mohammed Irfan" }
asOf: "2026-11-02"
rules:
  - { id: a-rule, document: aadhaar, prerequisite: pan }
  - { id: p-rule, document: pan,     prerequisite: aadhaar }
expect:
  order: [aadhaar, pan]
  warnings: [rule_cycle]
```

## 6. Data and privacy

The engine reads analysis results and targets already stored under Full Check consent; it stores nothing itself. Generated roadmaps are saved with the profile (M16 retention).

## 7. Language, accessibility and assisted mode

Rule text is localised in the knowledge base (F02); step reasons and labels exist in all four languages. Each step is one card with one primary action: "Show me how" (DIY) — "Ask 1dentity to help" is secondary.

## 11. Out of scope

Case creation and payment for assistance (P1: M04, M09, M19); notifications (F08).

## 13. Open questions

| ID | Question | Proposed default | Blocking? |
|---|---|---|---|
| Q-29 | What counts as an issue | Potential and major only | No (applied) |
| Q-30 | Free vs paid report | All free until payments ship | No |

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-05 | First draft from the Developer PRD | *Pending* |
