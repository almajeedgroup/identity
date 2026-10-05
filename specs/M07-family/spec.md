# M07 · Family profiles

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P1 (PRD §32: "family profiles") — increment 6d |
| **Spec owner** | Product owner + privacy officer |
| **Approvers** | Product owner · Privacy & grievance officer |
| **DPR trace** | §03 (families, elderly parents) · **PRD** §21 (family profile: father, mother, spouse, children, dependents, other authorised members; "must not automatically conclude a relationship is legally invalid"), §25 (family_groups) |
| **Depends on** | [M16](../M16-citizen-profile/spec.md) v0.3, [M17](../M17-documents-ocr/spec.md), [M04](../M04-request-help/spec.md), [F06](../F06-privacy/spec.md) v0.5, [F01](../F01-domain-model/spec.md) v0.9 |
| **Version** | 0.2 |

> **Approval note.** Built ahead of approval (DEC-2). Q-05 and Q-06 defaults applied: the account holder manages family members' documents with the member's permission, or as parent or guardian of a child under 18; the declaration is recorded. Members with their own phone may later get their own account (P2).

## 1. Summary

One account can hold up to **8 family members** besides the account holder. Each person has a separate profile: their own documents, targets, report, correction plan and help requests, never mixed with anyone else's. The holder chooses whose documents they are looking at, and every Full Check screen says whose they are. 1dentity can point out that a parent's or spouse's name differs between family members' documents, but never decides that a relationship is invalid.

## 3. User stories

### US1 — Add and switch *(must)*

- **M07-AC-1.1** — *Given* a holder with the Full Check, *when* they add a family member, *then* a name, a relationship (`father`, `mother`, `spouse`, `child`, `other`) and a declaration are required — "I have their permission to manage their documents", or for a child "I am their parent or guardian" with the holder's role (`father`, `mother`, `guardian`); at most 8 members; the declaration and its time are recorded, and `family.member_added` is audited (ids only).
- **M07-AC-1.2** — *Given* family members, *when* the holder chooses one, *then* every Full Check screen shows "Documents of: <name> (<relationship>)", and documents, targets, report, roadmap and help requests are those of that person only; a profile id that is not the holder's is "not found".
- **M07-AC-1.3** — *Given* a correction step for a family member, *when* the holder asks for help, *then* the case is for that member's document, with the member's name as applicant, and the holder follows it.

### US2 — Relationship names, information only *(must)*

- **M07-AC-2.1** — *Given* confirmed name targets, *when* a family member's page is shown, *then* the parent's or spouse's name printed on the relevant documents is compared with the related person's confirmed name (`M07-EX-relationship`) and differences are listed as information — "Banks and offices may ask about this" — never as a finding that the relationship is not real.

### US3 — Remove *(must)*

- **M07-AC-3.1** — *Given* a family member, *when* the holder removes them with confirmation, *then* their profile, documents, files, targets, reports and cases are deleted (files first), and `family.member_removed` is audited with counts.
- **M07-AC-3.2** — *Given* the holder withdraws the Full Check (F06-AC-3.1) or closes the account, *when* confirmed, *then* every family member's data is deleted too.

## 4. Functional requirements

- **M07-FR-01** — Family members are `citizen_profiles` rows of the holder with `relationship` ≠ `self`, plus `parent_role` (for a child), `consent_basis` (`their_permission`, `guardian`) and `declared_at`.
- **M07-FR-02** — The chosen person is kept in an `HttpOnly` cookie holding a profile id, checked against the holder on every request; missing or foreign → the holder's own profile.
- **M07-FR-03** — Relationship checks compare with the engine's name comparison (M02): differences of `potential_discrepancy` or `major_discrepancy` are listed; formatting differences are not.
- **M07-FR-04** — Audit events: `family.member_added`, `family.member_updated`, `family.member_removed`.

## 5. Executable examples

```yaml
id: M07-EX-relationship
holder: { name: "Mohammed Ibrahim" }
member: { relationship: child, parentRole: father }
cases:
  - { document: sslc, field: father_name, value: "MOHAMMED IBRAHIM", noted: false }
  - { document: sslc, field: father_name, value: "Mohd Ibrahim",     noted: true }
  - { document: pan,  field: father_name, value: "Ibrahim Khan",     noted: true }
```

## 6. Data and privacy

| Data item | Purpose | Basis | Stored where | Who can see it | Retention | Deleted by |
|---|---|---|---|---|---|---|
| Family member profile and declaration | Manage a relative's documents | The holder's declaration (member's permission or guardianship) under the holder's Full Check consent | Database | The holder; staff on a case for that member | Until removed, Full Check withdrawn or account closed | Holder |
| The member's documents, targets, reports, cases | As for the holder (M16, M17, M04) | As above | As M16/M17 | As above | As above | As above |

## 11. Out of scope

Members' own accounts and moving a member to their own account (P2), document expiry reminders for the family (M06), age verification of minors.

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-04 | Seed in `backlog.md` (P2) | — |
| 0.2 | 2026-10-05 | Full spec; P1 per the Developer PRD (increment 6d) | *Pending* |
