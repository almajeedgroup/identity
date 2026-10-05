# F06 · Privacy, consent and data lifecycle

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P0 (PRD) |
| **Spec owner** | Privacy & grievance officer |
| **Approvers** | Product owner · Privacy & grievance officer |
| **DPR trace** | §09 (DPDP-ready by design, data lifecycle) · **PRD** §23 (consent, privacy notice, retention and deletion policies, legal review), §27 ("Settings/privacy/data deletion") |
| **Depends on** | [F01](../F01-domain-model/spec.md) v0.4, [F05](../F05-auth/spec.md), [M15](../M15-access-audit/spec.md) |
| **Version** | 0.3 |

> **Approval note.** Built ahead of approval; the notice text is a draft for the legal review required before launch (PRD §34). The grievance officer is not yet appointed (DEC-2), so the notice points to the help desk until then.

## 1. Summary

A citizen is told, in their language, what the Full Check stores and why, and agrees **per purpose** before anything is stored. They can withdraw, delete documents, delete everything, or close their account at any time, and deletion really deletes.

## 3. User stories

### US1 — Consent per purpose *(must)*

- **F06-AC-1.1** — *Given* a signed-in citizen without Full Check consent, *when* they open the Full Check, *then* they see the notice for that purpose and nothing is stored until they agree; the consent records the notice version, language and time.
- **F06-AC-1.2** — *Given* the uploads purpose, *when* the citizen first uploads, *then* a separate notice is shown and agreed (M17-AC-2.1).
- **F06-AC-1.3** — *Given* the assistance purpose, *when* a citizen first asks 1dentity for help (M04), *then* a separate notice explains that the assigned volunteer and their supervisors will see the documents and details needed for that case, and nothing is shared with staff until the citizen agrees.

### US2 — A notice anyone can read *(must)*

- **F06-AC-2.1** — *Given* the privacy page in any of the four languages, *when* opened, *then* it states what is collected, why, how long it is kept (`F06-EX-retention`), who can see it, the citizen's rights, and how to raise a grievance — and that 1dentity is not a government office.

### US3 — Withdraw and delete *(must)*

- **F06-AC-3.1** — *Given* a citizen withdraws Full Check consent, *when* they confirm, *then* their profile, targets, overrides, documents and files are deleted, the consent is marked withdrawn, and they can start again later.
- **F06-AC-3.2** — *Given* a citizen withdraws upload consent, *when* they confirm, *then* every stored upload and OCR text of theirs is deleted, and uploads they never confirmed are deleted with them; typed and confirmed values stay.
- **F06-AC-3.4** — *Given* a citizen withdraws the assistance consent, *when* they confirm, *then* every open case is withdrawn and staff lose access at once (M04-AC-3.1).
- **F06-AC-3.3** — *Given* a citizen closes their account, *when* they confirm, *then* everything about them is deleted (F01-AC-4.3), their sessions end, and only pseudonymous audit events remain.

## 4. Functional requirements

- **F06-FR-01** — Purposes: `full_check` (store profile, documents, targets, reports), `uploads` (store files and OCR text), `assistance` (staff on the case see what the case needs, increment 6a), later `whatsapp` (F08). Notice version `2026-10-v2` (v1 plus the assistance section).
- **F06-FR-02** — Consent is checked on the server before every write for that purpose.
- **F06-FR-03** — Deletion removes stored files from the object store before rows are deleted, and writes one audit event with counts only.
- **F06-FR-04** — Retention schedule (configuration, Q-26): uploads 30 days after verification; profile and documents until the citizen deletes them; one-time codes 1 day; audit per Q-15.
- **F06-FR-05** — Minors (Q-06): this version is for adults managing their own documents; family and guardian flows arrive with M07 (P1).
- **F06-FR-06** — The privacy notice is at `/<locale>/privacy` and linked from every page footer; each consent screen links to it. Withdrawal and deletion live at `/<locale>/me/settings` and need an explicit "I understand" confirmation.
- **F06-FR-07** — Audit events: `consent.granted` (purpose, notice version, language), `consent.withdrawn` (purposes and counts), `account.closed` (counts) — never personal data.

## 5. Executable examples

```yaml
id: F06-EX-retention
items:
  - { data: uploads, kept: "30 days after you confirm the details" }
  - { data: profile_and_documents, kept: "until you delete them or close your account" }
  - { data: sign_in_codes, kept: "1 day" }
```

## 6. Data and privacy

This spec is the data-lifecycle policy for the Full Check; see the tables in M16 and M17.

## 11. Out of scope

Data export ("download my data"), guardians and minors, WhatsApp consent — P1.

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-04 | Seed in `backlog.md` | — |
| 0.2 | 2026-10-05 | P0 consent, notice, withdrawal and deletion for the Full Check | *Pending* |
| 0.3 | 2026-10-05 | Assistance purpose, notice v2 (increment 6a) | *Pending* |
