/** M15-AC-3.4 / M15-FR-08 · The audit log for the privacy officer and admins, with chain verification. */
import { tables, verifyAuditChain, writeAudit, type ChainCheck } from '@identity/db';
import { and, desc, eq, gte, like, lt, lte, type SQL } from 'drizzle-orm';
import { nowOf, ServiceError, type Services, type StaffActor } from '../services';
import { requirePermission } from './guard';

const { auditLogs } = tables;
export const AUDIT_PAGE_SIZE = 100;

export interface AuditFilters {
  actorKind?: string;
  actorId?: string;
  /** Prefix, e.g. `kb.` or `document.file_viewed`. */
  action?: string;
  /** YYYY-MM-DD, inclusive. */
  from?: string;
  to?: string;
  /** Show events with ids below this (paging). */
  before?: number;
}

export interface AuditPage {
  events: (typeof auditLogs.$inferSelect)[];
  nextBefore: number | null;
  chain: ChainCheck;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function listAuditEvents(s: Services, actor: StaffActor, filters: AuditFilters = {}): Promise<AuditPage> {
  await requirePermission(s, actor, 'audit.read');
  const where: SQL[] = [];
  if (filters.actorKind) {
    if (!['citizen', 'staff', 'system', 'anonymous'].includes(filters.actorKind)) throw new ServiceError('invalid_value');
    where.push(eq(auditLogs.actorKind, filters.actorKind as 'citizen'));
  }
  if (filters.actorId?.trim()) where.push(eq(auditLogs.actorId, filters.actorId.trim()));
  if (filters.action?.trim()) where.push(like(auditLogs.action, `${filters.action.trim().replace(/[%_\\]/g, '\\$&')}%`));
  if (filters.from) {
    if (!DATE.test(filters.from)) throw new ServiceError('invalid_date');
    where.push(gte(auditLogs.at, new Date(`${filters.from}T00:00:00Z`)));
  }
  if (filters.to) {
    if (!DATE.test(filters.to)) throw new ServiceError('invalid_date');
    where.push(lte(auditLogs.at, new Date(`${filters.to}T23:59:59.999Z`)));
  }
  if (filters.before) where.push(lt(auditLogs.id, filters.before));
  const rows = await s.db
    .select()
    .from(auditLogs)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(auditLogs.id))
    .limit(AUDIT_PAGE_SIZE + 1);
  const chain = await verifyAuditChain(s.db);
  await writeAudit(s.db, { actorKind: 'staff', actorId: actor.id, action: 'audit.viewed', details: { filtered: where.length > 0 } }, nowOf(s));
  const events = rows.slice(0, AUDIT_PAGE_SIZE);
  return { events, nextBefore: rows.length > AUDIT_PAGE_SIZE ? events[events.length - 1]!.id : null, chain };
}
