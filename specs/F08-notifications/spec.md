# F08 · Notifications — in-app and SMS

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P1 (PRD) — increment 6b; WhatsApp waits for ADR-009 |
| **Spec owner** | Tech lead |
| **Approvers** | Product owner · Privacy & grievance officer |
| **DPR trace** | §05, §06, §08 · **PRD** §20 (notifications), §23 (minimum data), §24 ("notification service: email/SMS/WhatsApp only through compliant/authorized providers") |
| **Depends on** | [F01](../F01-domain-model/spec.md) v0.7, [F04](../F04-i18n/spec.md), [F05](../F05-auth/spec.md) (sender interface, ADR-014), [F06](../F06-privacy/spec.md) v0.4, [M04](../M04-request-help/spec.md), [M09](../M09-case-queue/spec.md), [M17](../M17-documents-ocr/spec.md) |
| **Version** | 0.2 |

> **Approval note.** Built ahead of approval (DEC-2) in increment 6b. SMS goes through the same sender interface as sign-in codes (ADR-014): the development outbox now, a DLT-registered SMS provider after ADR-005 — the templates below must be registered before launch (DEC-5 for the sender name). WhatsApp (Q-13, ADR-009) is out of scope until a provider is chosen.

## 1. Summary

The case timeline and the documents list are the source of truth; notifications only point to them. Every event in `F08-EX-events` creates an **in-app notification** in the citizen's language. If the citizen has opted in, an **SMS** with the minimum information — the case ID, what happened and a link to 1dentity's own site — is sent too, never at night, and retried if it fails.

## 3. User stories

### US1 — In-app notifications *(must)*

- **F08-AC-1.1** — *Given* an event in `F08-EX-events`, *when* it happens, *then* an in-app notification is created for the citizen, shown in their language with the case ID or document it concerns and a link to it; the dashboard shows the number of unread notifications, and opening the list marks them read.

### US2 — SMS with the minimum *(must)*

- **F08-AC-2.1** — *Given* a citizen who has opted in to SMS updates, *when* an event marked `sms` happens, *then* an SMS in their language is sent with the text of `F08-EX-sms`: the service name, what happened, the case ID and a link to 1dentity's own domain — never names, document numbers, values or links to government portals.
- **F08-AC-2.2** — *Given* a citizen who has not opted in, or has opted out, *when* an event happens, *then* no SMS is sent and the in-app notification still appears.
- **F08-AC-2.3** — *Given* quiet hours (21:00–08:00 India time), *when* an SMS is due, *then* it is held and sent after 08:00.
- **F08-AC-2.4** — *Given* a send fails, *when* the delivery job runs, *then* it is retried up to 3 attempts in total and the final status (`sent` or `failed`) is recorded.

### US3 — The citizen chooses *(must)*

- **F08-AC-3.1** — *Given* a signed-in citizen, *when* they turn SMS updates on or off — when asking for help or in Settings — *then* the choice is recorded as consent for the purpose `sms` with time and language (F06), and audited.

## 4. Functional requirements

- **F08-FR-01** — Notifications store the citizen, the event kind, the case or document id, and parameters that hold no personal data (the case ID only); the text is produced in the citizen's language when shown or sent.
- **F08-FR-02** — Every template exists in English, Kannada, Hindi and Urdu (checked by a test) and stays within 160 characters for English before the link.
- **F08-FR-03** — Links use `APP_URL` and point to the citizen's own pages (`/<locale>/me/cases/<id>` or `/<locale>/me/documents`), which require sign-in.
- **F08-FR-04** — Delivery runs immediately after the event and again in the hourly housekeeping job for held and failed messages.
- **F08-FR-05** — Audit events: `notification.sms_sent`, `notification.sms_failed` (ids only); opt-in and opt-out are `consent.granted` / `consent.withdrawn` with purpose `sms`.

## 5. Executable examples

```yaml
id: F08-EX-events
events:
  - { kind: case_received,      when: "a help request creates a case (M04-AC-1.3)",             sms: true }
  - { kind: documents_needed,   when: "a case moves to awaiting_citizen",                       sms: true }
  - { kind: appointment_set,    when: "staff set or change an appointment",                     sms: true }
  - { kind: case_filed,         when: "staff record the application reference",                sms: true }
  - { kind: with_authority,     when: "a case moves to with_authority",                         sms: true }
  - { kind: case_completed,     when: "a case is completed",                                    sms: true }
  - { kind: case_closed,        when: "a case is closed or withdrawn by staff",                 sms: true }
  - { kind: recheck,            when: "a case is completed: re-run the Full Check",             sms: false }
  - { kind: verify_upload,      when: "an upload was read and waits for confirmation (M17)",    sms: false }
```

```yaml
id: F08-EX-sms
locale: en
appUrl: "https://1dentity.example"
case: { id: "0b8e2d7c-0000-4000-8000-000000000001", caseId: "ID-00042" }
messages:
  - { kind: case_received, text: "1dentity: we received your request ID-00042. Follow it here: https://1dentity.example/en/me/cases/0b8e2d7c-0000-4000-8000-000000000001" }
  - { kind: case_filed,    text: "1dentity: your application for ID-00042 has been filed. Details: https://1dentity.example/en/me/cases/0b8e2d7c-0000-4000-8000-000000000001" }
```

## 6. Data and privacy

| Data item | Purpose | Consent | Stored where | Who can see it | Retention | Deleted by |
|---|---|---|---|---|---|---|
| In-app notifications | Tell the citizen what changed | With the case or document | Database | The citizen | 90 days, or with the account | Housekeeping; account deletion |
| SMS delivery status | Retry and prove delivery | `sms` | Database (no message text) | The citizen; admins in aggregate | As the notification | As above |
| Mobile number | Send SMS | `sms` | Already stored (F05) | — | Account | Account deletion |

## 11. Out of scope

WhatsApp (ADR-009), email, push notifications, appointment reminders on the day before (they need M05 slots), satisfaction surveys (F11).

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-04 | Seed in `backlog.md` | — |
| 0.2 | 2026-10-05 | In-app and SMS notifications for increment 6b | *Pending* |
