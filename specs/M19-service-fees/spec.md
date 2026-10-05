# M19 · 1dentity service fees and payments

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P1 (PRD) — increment 6c; online payment waits for ADR-016 |
| **Spec owner** | Product owner |
| **Approvers** | Product owner · Finance lead · Privacy & grievance officer |
| **DPR trace** | DEC-4 · **PRD** §16B ("show 1dentity service fee separately"), §18 (service fee, payment status), §19 (revenue dashboard), §27 (service/fee confirmation), §28 ("clearly separate government charges from 1dentity service charges"), §29 (paid assistance; prices configurable) |
| **Depends on** | [M04](../M04-request-help/spec.md), [M09](../M09-case-queue/spec.md), [M13](../M13-rules-admin/spec.md) (service prices), [M15](../M15-access-audit/spec.md) v0.5, [F01](../F01-domain-model/spec.md) v0.8 |
| **Version** | 0.2 |

> **Approval note.** Built ahead of approval (DEC-2) in increment 6c. Only **1dentity's own service fee** is handled — government fees are never collected (C-01, R-02). Payments are recorded at the help desk (cash, UPI to 1dentity's account, card); online checkout needs a payment provider (ADR-016, open). The detailed report stays free until Q-30 is decided.

## 1. Summary

A case carries the 1dentity service fee for that help. If the price was known when the citizen asked for help, asking was agreeing to it; if it was "to be confirmed", a supervisor sets it and the citizen accepts it in the tracker before anything is charged. Staff record a desk payment and the citizen gets a numbered receipt that says plainly it is not a government fee. Supervisors can waive or refund with a reason and see what was collected.

## 3. User stories

### US1 — An agreed fee *(must)*

- **M19-AC-1.1** — *Given* a published service price applies when a case is created, *when* the request is submitted, *then* the case fee is that amount with status `due` (the request page showed it, M04-AC-1.1); *given* no price applies, *then* the status is `not_set`.
- **M19-AC-1.2** — *Given* a fee that is `not_set`, *when* a supervisor sets an amount, *then* the status becomes `awaiting_acceptance`, the citizen sees the amount — apart from any government fee — and can accept it (status `due`) or withdraw the case; no payment can be recorded before acceptance.

### US2 — Payments, waivers, refunds *(must)*

- **M19-AC-2.1** — *Given* a `due` fee, *when* staff record a payment with its method (cash, UPI, card) and optional transaction reference, *then* the status becomes `paid`, a receipt number `R-00001…` is issued, the citizen can open the receipt — headed "1dentity service fee", stating it is not a government fee — and `payment.recorded` is audited.
- **M19-AC-2.2** — *Given* an unpaid fee, *when* a supervisor waives it with a reason, *then* the status is `waived`; *given* a paid fee, *when* a supervisor refunds it with a reason and method, *then* a refund entry is added and the status is `refunded`. Volunteers can record payments but cannot set, waive or refund fees.

### US3 — Revenue *(must)*

- **M19-AC-3.1** — *Given* supervisors and admins, *when* they open the revenue view for a period (default: the last 30 days), *then* they see payments, refunds and net collected, totals per method, the number of waivers and the amount still due on open cases — computed from the payment ledger (`M19-EX-revenue`).

## 4. Functional requirements

- **M19-FR-01** — Fee statuses: `not_set`, `awaiting_acceptance`, `due`, `paid`, `waived`, `refunded`. Amounts are whole rupees, 0–100000.
- **M19-FR-02** — The ledger (`payments`) is append-only in the application: entries `payment` and `refund` with amount, method, optional reference, recorder, time and receipt number (one number sequence for both).
- **M19-FR-03** — Permissions (M15): `payments.record` (volunteer, supervisor, admin), `payments.manage` (supervisor, admin: set, waive, refund), `payments.read` (supervisor, admin: revenue).
- **M19-FR-04** — Receipts show: receipt number, date, case ID, amount, method, "1dentity service fee", the organisation name, and "This is not a government fee. Government fees are paid only to the issuing authority."
- **M19-FR-05** — Audit events: `payment.fee_set`, `payment.fee_accepted`, `payment.recorded`, `payment.waived`, `payment.refunded` (case id, amount, method — no personal data).

## 5. Executable examples

```yaml
id: M19-EX-revenue
ledger:
  - { kind: payment, amountInr: 199, method: cash, at: "2026-10-02" }
  - { kind: payment, amountInr: 199, method: upi,  at: "2026-10-03" }
  - { kind: payment, amountInr: 99,  method: upi,  at: "2026-09-01" }
  - { kind: refund,  amountInr: 199, method: cash, at: "2026-10-04" }
period: { from: "2026-09-15", to: "2026-10-05" }
expect: { payments: 398, refunds: 199, net: 199, byMethod: { cash: 0, upi: 199 }, count: 2 }
```

## 6. Data and privacy

| Data item | Purpose | Basis | Stored where | Who can see it | Retention | Deleted by |
|---|---|---|---|---|---|---|
| Fee and ledger entries | Charge, receipts, accounts | Contract (the help asked for) | Database | The citizen (own receipts); staff on the case; supervisors (revenue) | Per accounting law (Q-32, default 8 years), anonymised with the case | — (kept for accounts; the citizen link is removed on account deletion) |

## 11. Out of scope

Online checkout and webhooks (ADR-016), GST invoices (Q-33), paid detailed reports (Q-30), family plans.

## 13. Open questions

| ID | Question | Proposed default | Blocking? |
|---|---|---|---|
| Q-32 | How long must payment records be kept? | 8 years (Indian accounting practice), confirmed in the legal review | Before launch |
| Q-33 | Is GST due on service fees, and must receipts be tax invoices? | Ask the finance lead before charging any fee | Before charging |

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-05 | Seed in the register (PRD §16B, §18, §29) | — |
| 0.2 | 2026-10-05 | Full spec for increment 6c | *Pending* |
