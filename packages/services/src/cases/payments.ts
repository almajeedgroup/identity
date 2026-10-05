/** M19 · The 1dentity service fee on a case: agree, pay at the desk, waive, refund, and revenue. Never government fees (C-01). */
import { tables, writeAudit } from '@identity/db';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { nowOf, ServiceError, type Services, type StaffActor } from '../services';
import { requirePermission } from '../staff/guard';
import { caseIdOf, isOpen, loadCase, type CaseRow } from './common';

const { cases, payments } = tables;

export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type FeeStatus = CaseRow['feeStatus'];

export const receiptNumber = (n: number) => `R-${String(n).padStart(5, '0')}`;

const audit = (s: Services, actor: { kind: 'staff' | 'citizen'; id: string }, action: string, row: CaseRow, details: Record<string, unknown>, now: Date) =>
  writeAudit(s.db, { actorKind: actor.kind, actorId: actor.id, action, subjectKind: 'case', subjectId: row.id, details }, now);

async function caseOrNotFound(s: Services, caseId: string): Promise<CaseRow> {
  const row = await loadCase(s.db, caseId);
  if (!row) throw new ServiceError('not_found');
  return row;
}

const cleanAmount = (amount: number) => {
  if (!Number.isInteger(amount) || amount < 0 || amount > 100_000) throw new ServiceError('invalid_value');
  return amount;
};

/** M19-AC-1.2 · A supervisor sets the fee when it was "to be confirmed"; the citizen must accept it. */
export async function setCaseFee(s: Services, actor: StaffActor, caseId: string, input: { amountInr: number; note?: string }): Promise<void> {
  await requirePermission(s, actor, 'payments.manage', { kind: 'case', id: caseId });
  const row = await caseOrNotFound(s, caseId);
  if (!isOpen(row.state)) throw new ServiceError('case_closed');
  if (!['not_set', 'awaiting_acceptance'].includes(row.feeStatus)) throw new ServiceError('not_allowed');
  const amount = cleanAmount(input.amountInr);
  const now = nowOf(s);
  await s.db
    .update(cases)
    .set({ feeAmountInr: amount, feeStatus: amount === 0 ? 'waived' : 'awaiting_acceptance', feeNote: input.note?.trim().slice(0, 200) || null, updatedAt: now })
    .where(eq(cases.id, row.id));
  await audit(s, { kind: 'staff', id: actor.id }, 'payment.fee_set', row, { amountInr: amount }, now);
}

export async function acceptCaseFee(s: Services, userId: string, caseId: string): Promise<void> {
  const row = await caseOrNotFound(s, caseId);
  if (row.userId !== userId) throw new ServiceError('not_found');
  if (row.feeStatus !== 'awaiting_acceptance') throw new ServiceError('not_allowed');
  const now = nowOf(s);
  await s.db.update(cases).set({ feeStatus: 'due', updatedAt: now }).where(eq(cases.id, row.id));
  await audit(s, { kind: 'citizen', id: userId }, 'payment.fee_accepted', row, { amountInr: row.feeAmountInr }, now);
}

/** M19-AC-2.1 · A desk payment; returns the receipt number. */
export async function recordPayment(s: Services, actor: StaffActor, caseId: string, input: { method: string; reference?: string }): Promise<string> {
  await requirePermission(s, actor, 'payments.record', { kind: 'case', id: caseId });
  const row = await caseOrNotFound(s, caseId);
  if (row.feeStatus !== 'due' || !row.feeAmountInr) throw new ServiceError('not_allowed');
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) throw new ServiceError('invalid_value');
  const now = nowOf(s);
  const [entry] = await s.db.transaction(async (tx) => {
    const inserted = await tx
      .insert(payments)
      .values({ caseId: row.id, caseLabel: caseIdOf(row), kind: 'payment', amountInr: row.feeAmountInr!, method: input.method as PaymentMethod, reference: input.reference?.trim().slice(0, 80) || null, recordedById: actor.id, at: now })
      .returning();
    await tx.update(cases).set({ feeStatus: 'paid', updatedAt: now }).where(eq(cases.id, row.id));
    return inserted;
  });
  await audit(s, { kind: 'staff', id: actor.id }, 'payment.recorded', row, { amountInr: entry!.amountInr, method: entry!.method, receipt: receiptNumber(entry!.number) }, now);
  return receiptNumber(entry!.number);
}

/** M19-AC-2.2 */
export async function waiveFee(s: Services, actor: StaffActor, caseId: string, reason: string): Promise<void> {
  await requirePermission(s, actor, 'payments.manage', { kind: 'case', id: caseId });
  const row = await caseOrNotFound(s, caseId);
  const why = reason.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!why) throw new ServiceError('reason_required');
  if (!['not_set', 'awaiting_acceptance', 'due'].includes(row.feeStatus)) throw new ServiceError('not_allowed');
  const now = nowOf(s);
  await s.db.update(cases).set({ feeStatus: 'waived', feeNote: why, updatedAt: now }).where(eq(cases.id, row.id));
  await audit(s, { kind: 'staff', id: actor.id }, 'payment.waived', row, { reason: why }, now);
}

export async function refundFee(s: Services, actor: StaffActor, caseId: string, input: { method: string; reason: string }): Promise<string> {
  await requirePermission(s, actor, 'payments.manage', { kind: 'case', id: caseId });
  const row = await caseOrNotFound(s, caseId);
  const why = input.reason.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!why) throw new ServiceError('reason_required');
  if (row.feeStatus !== 'paid') throw new ServiceError('not_allowed');
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) throw new ServiceError('invalid_value');
  const paid = (await s.db.select().from(payments).where(and(eq(payments.caseId, row.id), eq(payments.kind, 'payment')))).reduce((a, p) => a + p.amountInr, 0);
  const now = nowOf(s);
  const [entry] = await s.db.transaction(async (tx) => {
    const inserted = await tx
      .insert(payments)
      .values({ caseId: row.id, caseLabel: caseIdOf(row), kind: 'refund', amountInr: paid, method: input.method as PaymentMethod, note: why, recordedById: actor.id, at: now })
      .returning();
    await tx.update(cases).set({ feeStatus: 'refunded', feeNote: why, updatedAt: now }).where(eq(cases.id, row.id));
    return inserted;
  });
  await audit(s, { kind: 'staff', id: actor.id }, 'payment.refunded', row, { amountInr: paid, method: input.method, receipt: receiptNumber(entry!.number) }, now);
  return receiptNumber(entry!.number);
}

export interface LedgerEntry {
  number: string;
  kind: 'payment' | 'refund';
  amountInr: number;
  method: PaymentMethod;
  reference: string | null;
  at: Date;
  caseLabel: string;
}

const toEntry = (p: typeof payments.$inferSelect): LedgerEntry => ({ number: receiptNumber(p.number), kind: p.kind, amountInr: p.amountInr, method: p.method, reference: p.reference, at: p.at, caseLabel: p.caseLabel });

export async function caseLedger(s: Services, caseId: string): Promise<LedgerEntry[]> {
  return (await s.db.select().from(payments).where(eq(payments.caseId, caseId)).orderBy(asc(payments.number))).map(toEntry);
}

/** M19-FR-04 · A receipt for the citizen whose case it is. */
export async function myReceipt(s: Services, userId: string, caseId: string, number: string): Promise<LedgerEntry | null> {
  const row = await loadCase(s.db, caseId);
  if (!row || row.userId !== userId) return null;
  return (await caseLedger(s, row.id)).find((e) => e.number === number) ?? null;
}

// ---------------------------------------------------------------- revenue (M19-AC-3.1)

export interface RevenueSummary {
  payments: number;
  refunds: number;
  net: number;
  byMethod: Partial<Record<PaymentMethod, number>>;
  count: number;
}

/** M19-EX-revenue · pure: totals of ledger entries within [from, to] (YYYY-MM-DD, India time, inclusive). */
export function summariseLedger(entries: { kind: 'payment' | 'refund'; amountInr: number; method: PaymentMethod; at: Date }[], from: string, to: string): RevenueSummary {
  const day = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const inPeriod = entries.filter((e) => day(e.at) >= from && day(e.at) <= to);
  const out: RevenueSummary = { payments: 0, refunds: 0, net: 0, byMethod: {}, count: 0 };
  for (const e of inPeriod) {
    const sign = e.kind === 'payment' ? 1 : -1;
    if (e.kind === 'payment') {
      out.payments += e.amountInr;
      out.count++;
    } else out.refunds += e.amountInr;
    out.byMethod[e.method] = (out.byMethod[e.method] ?? 0) + sign * e.amountInr;
  }
  out.net = out.payments - out.refunds;
  return out;
}

export async function revenue(s: Services, actor: StaffActor, period?: { from?: string; to?: string }): Promise<RevenueSummary & { from: string; to: string; waived: number; outstanding: number; entries: LedgerEntry[] }> {
  await requirePermission(s, actor, 'payments.read');
  const now = nowOf(s);
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const to = period?.to && DATE.test(period.to) ? period.to : new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const from = period?.from && DATE.test(period.from) ? period.from : new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10);
  if (from > to) throw new ServiceError('invalid_date');
  const start = new Date(`${from}T00:00:00+05:30`);
  const end = new Date(`${to}T23:59:59.999+05:30`);
  const rows = await s.db.select().from(payments).where(and(gte(payments.at, start), lte(payments.at, end))).orderBy(asc(payments.number));
  const open = await s.db.select().from(cases).where(inArray(cases.feeStatus, ['due', 'waived']));
  const waived = open.filter((c) => c.feeStatus === 'waived' && c.updatedAt >= start && c.updatedAt <= end).length;
  const outstanding = open.filter((c) => c.feeStatus === 'due' && isOpen(c.state)).reduce((a, c) => a + (c.feeAmountInr ?? 0), 0);
  await writeAudit(s.db, { actorKind: 'staff', actorId: actor.id, action: 'payment.revenue_viewed', details: { from, to } }, now);
  return { ...summariseLedger(rows, from, to), from, to, waived, outstanding, entries: rows.map(toEntry) };
}
