/** M15-AC-3.x · Append-only, hash-chained audit log. Details carry ids and counts — never personal data. */
import { asc, desc, gt, sql } from 'drizzle-orm';
import type { Db } from './client';
import { sha256Hex } from './crypto';
import { auditLogs } from './schema';

export type ActorKind = 'citizen' | 'staff' | 'system' | 'anonymous';

export interface AuditEvent {
  actorKind: ActorKind;
  actorId?: string | null;
  action: string;
  subjectKind?: string | null;
  subjectId?: string | null;
  details?: Record<string, unknown>;
}

export const GENESIS_HASH = '0'.repeat(64);

/** Keys sorted at every level, so the hash survives JSONB storage. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

interface HashedFields {
  at: Date;
  actorKind: string;
  actorId: string | null;
  action: string;
  subjectKind: string | null;
  subjectId: string | null;
  details: unknown;
}

export function hashEvent(prevHash: string, e: HashedFields): string {
  return sha256Hex(
    prevHash +
      canonicalJson({
        at: e.at.toISOString(),
        actorKind: e.actorKind,
        actorId: e.actorId,
        action: e.action,
        subjectKind: e.subjectKind,
        subjectId: e.subjectId,
        details: e.details,
      }),
  );
}

export async function writeAudit(db: Db, event: AuditEvent, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    // M15-FR-04 · one writer at a time keeps the chain linear.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(4242)`);
    const [last] = await tx.select({ hash: auditLogs.hash }).from(auditLogs).orderBy(desc(auditLogs.id)).limit(1);
    const row: HashedFields = {
      at: new Date(now.getTime()),
      actorKind: event.actorKind,
      actorId: event.actorId ?? null,
      action: event.action,
      subjectKind: event.subjectKind ?? null,
      subjectId: event.subjectId ?? null,
      details: event.details ?? {},
    };
    const prevHash = last?.hash ?? GENESIS_HASH;
    await tx.insert(auditLogs).values({ ...row, actorKind: row.actorKind as ActorKind, details: row.details as object, prevHash, hash: hashEvent(prevHash, row) });
  });
}

export type ChainCheck = { ok: true; count: number } | { ok: false; count: number; brokenAt: number };

/** M15-AC-3.3 */
export async function verifyAuditChain(db: Db, batch = 500): Promise<ChainCheck> {
  let prevHash = GENESIS_HASH;
  let lastId = 0;
  let count = 0;
  for (;;) {
    const rows = await db.select().from(auditLogs).where(gt(auditLogs.id, lastId)).orderBy(asc(auditLogs.id)).limit(batch);
    if (rows.length === 0) return { ok: true, count };
    for (const r of rows) {
      const expected = hashEvent(prevHash, { ...r, details: r.details });
      if (r.prevHash !== prevHash || r.hash !== expected) return { ok: false, count, brokenAt: r.id };
      prevHash = r.hash;
      lastId = r.id;
      count++;
    }
  }
}
