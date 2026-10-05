# M15 · Access and audit

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P0 (PRD) |
| **Spec owner** | Tech lead + privacy officer |
| **Approvers** | Product owner · Privacy & grievance officer · QA & security tester |
| **DPR trace** | §05 (Access & Audit), §09 (security controls, volunteer code of conduct) · **PRD** §19 (audit logs), §23 (RBAC, least privilege, masking, audit of access/downloads/edits/case actions), §28 (override audit trail), §33 ("all important staff actions are auditable") |
| **Depends on** | [F01](../F01-domain-model/spec.md) v0.3, [F05](../F05-auth/spec.md) |
| **Version** | 0.5 |

> **Approval note.** Built ahead of approval (DEC-2): controls in increment 3, the staff console (US5, US6, audit viewer) in increment 5. Deletion jobs for case documents arrive with cases (P1); the upload-retention job (Q-26) runs hourly.

## 1. Summary

Staff see only what their role needs; sensitive identifiers are masked; and every access, download, edit and decision leaves a **tamper-evident** trail that the privacy officer can read and verify.

## 3. User stories

### US1 — Roles and least privilege *(must)*

- **M15-AC-1.1** — *Given* the permission matrix (`M15-EX-permissions`), *when* a staff member with a role attempts an action, *then* it is allowed or refused exactly as listed; a refused action writes an `access.denied` audit event.
- **M15-AC-1.2** — *Given* a citizen session, *when* any staff page or staff action is requested, *then* it is refused.
- **M15-AC-1.3** — *Given* a staff member is suspended or offboarded, *when* the change is saved, *then* their sessions are revoked immediately (F05-AC-3.2).

### US2 — Masked identifiers *(must)*

- **M15-AC-2.1** — *Given* document numbers, *when* shown in any view that does not need the full value, *then* spaces are removed and all but the last four characters are replaced, as in `M15-EX-masking`; Aadhaar is only ever stored and shown as its last four digits (C-03).

### US3 — Tamper-evident audit log *(must)*

- **M15-AC-3.1** — *Given* audit events, *when* written, *then* each stores time, actor kind and id, action, subject kind and id, details without personal data, and a SHA-256 hash chained to the previous event.
- **M15-AC-3.2** — *Given* the audit table, *when* anyone tries to update or delete a row, *then* the database refuses.
- **M15-AC-3.3** — *Given* an audit chain, *when* verified, *then* it reports intact; *given* a row altered outside the application, *then* verification reports the first broken event.
- **M15-AC-3.4** — *Given* the privacy officer or an admin, *when* they open the audit log, *then* they can filter by actor, action and date, and see the verification result; other roles cannot open it.

### US4 — Retention jobs *(must)*

- **M15-AC-4.1** — *Given* uploads verified more than 30 days ago and not attached to an open case (Q-26), *when* the retention job runs, *then* their files are deleted from storage, the upload rows are marked purged, and one audit event per purge is written; uploads not yet due are untouched.

### US5 — Staff console without personal data *(must)*

- **M15-AC-5.1** — *Given* a staff member with `dashboard.read` signed in with 2FA, *when* they open the console, *then* they see counts only: customers, Full Check profiles, documents waiting for the citizen's confirmation, issues in the latest reports, stored uploads, and knowledge-base items by status and freshness; the P1 tiles (cases, fees, workload) say they arrive with assistance cases.
- **M15-AC-5.2** — *Given* `customers.read`, *when* the customer list is opened or searched by a full mobile number, *then* each customer shows only a reference, the mobile number masked to its last four digits, dates, number of documents, consents and issue count — never names, document values or files, which staff see only once the citizen asks for assistance (P1, C-06) — and the view writes `customers.listed` or `customer.viewed`.

### US6 — Team management *(must)*

- **M15-AC-6.1** — *Given* an admin, *when* they add a staff member, *then* email, name, an initial password of at least 12 characters (handed over in person; changing it is P1) and at least one role are required, the new member enrols 2FA at first sign-in, and `staff.created` is written; *when* they change roles, suspend, reactivate or offboard someone, *then* the change is audited and suspension or offboarding revokes that person's sessions at once (M15-AC-1.3).
- **M15-AC-6.2** — *Given* an admin, *when* they try to remove their own admin role, suspend or offboard themselves, *then* it is refused, so the console always keeps an admin.

## 4. Functional requirements

- **M15-FR-01** — Staff roles: `volunteer`, `supervisor`, `content_editor`, `publisher`, `privacy_officer`, `admin`. A staff member may hold several roles.
- **M15-FR-02** — Permissions are checked on the server for every staff page, server action and route handler — never only in the UI.
- **M15-FR-03** — Audit actions use dotted names (`auth.citizen.signed_in`, `document.file_viewed`, `kb.rule.published`, `access.denied` …). Details never include names, numbers or document contents — only ids, counts and masked values.
- **M15-FR-04** — Hash: `sha256(prev_hash ‖ canonical JSON of the event without its hash)`; the first event chains from 64 zeros. Writers take a transaction-level advisory lock so the chain is linear.
- **M15-FR-05** — The audit table is append-only through a database trigger.
- **M15-FR-06** — Staff lifecycle: `active` → `suspended` → `active`, or → `offboarded` (final). Creating staff and changing roles are admin-only and audited.
- **M15-FR-07** — The first admin is created from the command line (`npm run staff:create`). In development and tests only, `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` create one at start-up when no staff exist; production ignores them.
- **M15-FR-08** — The audit viewer shows 100 events per page, newest first, filtered by actor kind, actor id, action prefix and date range, with the result of `verifyAuditChain`; opening it writes `audit.viewed`.
- **M15-FR-09** — The staff console lives at `/staff`, in English (C-08 covers citizen screens), outside the citizen layout, and every page and action checks the permission on the server (M15-FR-02); a missing permission shows "not found" and writes `access.denied`.

## 5. Executable examples

```yaml
id: M15-EX-permissions
cases:
  - { roles: [volunteer],       permission: dashboard.read,  allowed: true }
  - { roles: [volunteer],       permission: rules.edit,      allowed: false }
  - { roles: [volunteer],       permission: audit.read,      allowed: false }
  - { roles: [volunteer],       permission: customers.read,  allowed: true }
  - { roles: [content_editor],  permission: rules.edit,      allowed: true }
  - { roles: [content_editor],  permission: rules.publish,   allowed: false }
  - { roles: [publisher],       permission: rules.publish,   allowed: true }
  - { roles: [publisher],       permission: rules.edit,      allowed: true }
  - { roles: [privacy_officer], permission: audit.read,      allowed: true }
  - { roles: [privacy_officer], permission: rules.edit,      allowed: false }
  - { roles: [supervisor],      permission: customers.read,  allowed: true }
  - { roles: [supervisor],      permission: staff.manage,    allowed: false }
  - { roles: [admin],           permission: staff.manage,    allowed: true }
  - { roles: [admin],           permission: audit.read,      allowed: true }
  - { roles: [content_editor, privacy_officer], permission: audit.read, allowed: true }
  - { roles: [],                permission: dashboard.read,  allowed: false }
  - { roles: [volunteer],       permission: cases.work,      allowed: true }
  - { roles: [volunteer],       permission: cases.manage,    allowed: false }
  - { roles: [supervisor],      permission: cases.manage,    allowed: true }
  - { roles: [privacy_officer], permission: cases.work,      allowed: false }
  - { roles: [content_editor],  permission: cases.work,      allowed: false }
  - { roles: [volunteer],       permission: payments.record, allowed: true }
  - { roles: [volunteer],       permission: payments.manage, allowed: false }
  - { roles: [volunteer],       permission: payments.read,   allowed: false }
  - { roles: [supervisor],      permission: payments.manage, allowed: true }
  - { roles: [supervisor],      permission: payments.read,   allowed: true }
```

```yaml
id: M15-EX-masking
cases:
  - { kind: pan,             number: "ABCPE1234F",   masked: "••••••234F" }
  - { kind: passport,        number: "N1234567",     masked: "••••4567" }
  - { kind: voter_id,        number: "XYZ1234567",   masked: "••••••4567" }
  - { kind: aadhaar,         last4: "2346",          masked: "XXXX XXXX 2346" }
  - { kind: driving_licence, number: "KA01 20110012345", masked: "•••••••••••2345" }
```

## 6. Data and privacy

The audit log holds pseudonymous ids and actions, never personal data (M15-FR-03). Retention per Q-15 (legal review); until then kept indefinitely, append-only.

## 11. Out of scope

Case-document deletion (P1); monthly access reviews as a scheduled report (P1).

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-04 | Seed in `backlog.md` | — |
| 0.2 | 2026-10-05 | Full spec for the PRD P0 build | *Pending* |
| 0.3 | 2026-10-05 | Staff console (increment 5): dashboard and customer list without personal data, team management, audit viewer details, first admin | *Pending* |
| 0.4 | 2026-10-05 | Case permissions `cases.work` and `cases.manage` (M09, increment 6a) | *Pending* |
| 0.5 | 2026-10-05 | Payment permissions (M19, increment 6c) | *Pending* |
