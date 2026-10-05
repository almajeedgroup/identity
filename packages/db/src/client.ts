/** ADR-011 · One schema, two drivers: PostgreSQL (DATABASE_URL) or embedded PGlite (development and tests). */
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { MIGRATIONS } from './migrations.generated';
import * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface Database {
  db: Db;
  driver: 'postgres' | 'pglite';
  close(): Promise<void>;
}

export interface DatabaseOptions {
  /** PostgreSQL connection string. When absent, PGlite is used. */
  url?: string;
  /** PGlite data directory; `memory://` (default) for an in-memory database. */
  pgliteDir?: string;
}

export async function openDatabase(options: DatabaseOptions = {}): Promise<Database> {
  if (options.url) {
    const { Pool } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const pool = new Pool({ connectionString: options.url, max: 10 });
    return { db: drizzle(pool, { schema }) as unknown as Db, driver: 'postgres', close: () => pool.end() };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const client = new PGlite(options.pgliteDir ?? 'memory://');
  return { db: drizzle(client, { schema }) as unknown as Db, driver: 'pglite', close: () => client.close() };
}

/** Applies embedded migrations once each, in order, each in its own transaction (F01-AC-4.2). */
export async function migrate(db: Db): Promise<string[]> {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS identity_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const result = (await db.execute(sql`SELECT id FROM identity_migrations`)) as unknown as { rows: { id: string }[] };
  const done = new Set(result.rows.map((r) => r.id));
  const applied: string[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await db.transaction(async (tx) => {
      for (const statement of m.sql.split('--> statement-breakpoint')) {
        if (statement.trim()) await tx.execute(sql.raw(statement));
      }
      await tx.execute(sql`INSERT INTO identity_migrations (id) VALUES (${m.id})`);
    });
    applied.push(m.id);
  }
  return applied;
}

export { schema };
