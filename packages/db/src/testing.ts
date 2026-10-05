/** Test helpers: a fresh, migrated database per call — in-memory PGlite, or a new PostgreSQL database when TEST_DATABASE_URL is set. */
import { randomBytes } from 'node:crypto';
import { migrate, openDatabase, type Database } from './client';
import { generateKey, parseKeyring } from './crypto';

export async function freshDatabase(): Promise<Database> {
  const adminUrl = process.env.TEST_DATABASE_URL;
  if (!adminUrl) {
    const database = await openDatabase();
    await migrate(database.db);
    return database;
  }
  const { Client } = await import('pg');
  const name = `identity_t_${randomBytes(6).toString('hex')}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const database = await openDatabase({ url: url.toString() });
  await migrate(database.db);
  return database;
}

export const testKeyring = (id = 'test-1') => parseKeyring(`${id}:${generateKey()}`, id);
