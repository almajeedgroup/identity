# <ID> · <Title>

| | |
|---|---|
| **Status** | Draft · In review · Approved · Planned · In build · Verified · Released · Superseded |
| **Size** | Full · Lite *(lite specs fill sections 1–4, 11 and 13 only)* |
| **Phase** | P1 · P2 · P3 |
| **Spec owner** | <name, role> |
| **Approvers** | Product owner · Privacy & grievance officer *(if any personal data)* · Field coordinator *(if staff-facing)* |
| **DPR trace** | §<nn>, … |
| **Depends on** | <spec IDs> |
| **Version** | 0.1 |

## 1. Summary

Three sentences: the problem, who has it, and what this spec changes for them.

## 2. Users and scenarios

Which personas (DPR §03) and which roles (citizen, volunteer, supervisor, coordinator, content editor, admin) this serves, and in what situation.

## 3. User stories

Prioritised. Each story must be independently testable and demonstrable.

### US1 — <short name> *(priority: must)*

As a <role>, I want <capability>, so that <outcome>.

**Acceptance scenarios**

- **<ID>-AC-1.1** — *Given* <context>, *when* <action>, *then* <observable result>.
- **<ID>-AC-1.2** — …

### US2 — …

## 4. Functional requirements

- **<ID>-FR-01** — The system MUST …
- **<ID>-FR-02** — The system SHOULD …

Mark anything uncertain as `[NEEDS CLARIFICATION: Q-xx — <question>; proposed default: …]`.

## 5. Executable examples

Tables for every rule or calculation. CI exports these tables to `tests/fixtures/<ID>/` and runs them; do not paraphrase them in tests.

| Example ID | Inputs | Expected output |
|---|---|---|
| <ID>-EX-<slug> | … | … |

## 6. Data and privacy *(mandatory for full specs; privacy officer signs off)*

| Data item | Purpose | Consent / basis | Stored where | Who can see it | Retention | Deleted or anonymised by |
|---|---|---|---|---|---|---|
| … | … | … | Device only · Database · Object storage · Logs | … | … | … |

- Audit events this feature emits:
- Constitution principles engaged (C-02 to C-07):
- Minors (under 18): how they are handled, if relevant:

## 7. Language, accessibility and assisted mode

- **Languages:** all citizen-facing text in en, kn, hi, ur; Urdu RTL notes.
- **Accessibility:** status shown as colour + icon + word; touch targets; large-text mode; screen-reader notes.
- **Assisted mode:** how a volunteer completes this flow alongside the citizen (desk, WhatsApp video, camp, doorstep).
- **One next step:** the single primary action on each screen.

## 8. Non-functional requirements

Performance on the budget-phone profile, offline behaviour, availability, security.

## 9. Content dependencies

D-specs, Content Manager entries, translations and media this feature needs, and by when.

## 10. Edge cases and failure modes

Network loss, official-portal downtime, duplicate submissions, wrong language, withdrawn consent, etc.

## 11. Out of scope

What this spec deliberately does not do, and where it is handled instead.

## 12. Success measures

Which F11 events and KPIs show this works.

## 13. Open questions

| ID | Question | Proposed default | Blocking? |
|---|---|---|---|
| Q-xx | … | … | Yes / No |

## 14. Gate 1 checklist — spec ready

- [ ] Stories prioritised; each independently testable
- [ ] Every story has Given/When/Then acceptance scenarios with IDs
- [ ] Executable examples for every rule or calculation
- [ ] Data and privacy table complete and signed off by the privacy officer
- [ ] Languages, accessibility and assisted mode described
- [ ] Content dependencies listed and scheduled
- [ ] Out of scope explicit
- [ ] No blocking `[NEEDS CLARIFICATION]` remains

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | | First draft | |
