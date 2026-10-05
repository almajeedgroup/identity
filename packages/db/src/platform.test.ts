import { seedKnowledgeBase } from '@identity/content';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadExample } from '../../../tools/spec/specs';
import { verifyAuditChain, writeAudit } from './audit';
import { normaliseMobile, requestCode, verifyCode, OTP_TTL_MS } from './auth/citizen';
import { createSession, resolveSession, revokeSessionByToken, SESSION_POLICY } from './auth/sessions';
import { beginTotpEnrolment, createStaff, setStaffStatus, staffSignIn, verifyStaffTotp } from './auth/staff';
import { migrate, type Database } from './client';
import { loadConfig } from './config';
import { decryptBytes, decryptValue, encryptBytes, encryptValue, generateKey, hashPassword, parseKeyring, sha256Hex, verifyPassword } from './crypto';
import { effectiveVersion, loadKnowledgeBase, seedKnowledgeBaseIfEmpty } from './kb-store';
import { maskAadhaar, maskNumber } from './masking';
import { DevOutboxSender, createOtpSender, latestOutboxMessage } from './otp';
import { can } from './permissions';
import { purgeDueUploads } from './retention';
import * as t from './schema';
import { EncryptedStore, MAX_UPLOAD_BYTES, MemoryRawStore, sniffType } from './storage';
import { freshDatabase, testKeyring } from './testing';
import { base32Decode, base32Encode, totpAt, verifyTotp } from './totp';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let database: Database;
beforeAll(async () => {
  database = await freshDatabase();
});
afterAll(async () => {
  await database.close();
});

async function makeCitizenWithDocument(db: Database['db']) {
  const [user] = await db.insert(t.users).values({ mobile: `+9198${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}` }).returning();
  const [profile] = await db.insert(t.citizenProfiles).values({ userId: user!.id }).returning();
  const [doc] = await db.insert(t.documents).values({ profileId: profile!.id, kind: 'pan', jurisdiction: 'IN-KA', source: 'manual' }).returning();
  return { user: user!, profile: profile!, doc: doc! };
}

describe('F01 v0.3 persistence', () => {
  it('@F01-AC-4.2 migrations apply to an empty database and a second run changes nothing', async () => {
    const again = await migrate(database.db);
    expect(again).toEqual([]);
    const tables = (await database.db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`)) as unknown as { rows: { table_name: string }[] };
    expect(tables.rows.map((r) => r.table_name)).toEqual(expect.arrayContaining(['users', 'documents', 'document_fields', 'kb_items', 'audit_logs', 'sessions']));
  });

  it('@F01-AC-4.1 original values are immutable in the database (C-16); confirmed values can change', async () => {
    const { db } = database;
    const { doc } = await makeCitizenWithDocument(db);
    const [field] = await db.insert(t.documentFields).values({ documentId: doc.id, version: 1, field: 'name', original: 'MOHD IBRAHIM', source: 'ocr', confidence: 0.91 }).returning();
    await db.update(t.documentFields).set({ confirmed: 'Mohd Ibrahim' }).where(eq(t.documentFields.id, field!.id));
    await expect(db.update(t.documentFields).set({ original: 'changed' }).where(eq(t.documentFields.id, field!.id))).rejects.toThrow();
    const [after] = await db.select().from(t.documentFields).where(eq(t.documentFields.id, field!.id));
    expect(after!.original).toBe('MOHD IBRAHIM');
    expect(after!.confirmed).toBe('Mohd Ibrahim');
  });

  it('@F01-AC-4.3 deleting an account removes all of the citizen’s data and keeps pseudonymous audit events', async () => {
    const { db } = database;
    const { user, profile, doc } = await makeCitizenWithDocument(db);
    await db.insert(t.documentFields).values({ documentId: doc.id, version: 1, field: 'name', original: 'X', source: 'manual' });
    await db.insert(t.documentVersions).values({ documentId: doc.id, version: 1, reason: 'created', createdByKind: 'citizen' });
    const [up] = await db.insert(t.uploads).values({ documentId: doc.id, storageKey: crypto.randomUUID(), mime: 'image/png', sizeBytes: 1, sha256: 'x' }).returning();
    await db.insert(t.ocrExtractions).values({ documentId: doc.id, uploadId: up!.id, provider: 'test', engineVersion: '1', rawText: 'enc', fields: {} });
    await db.insert(t.masterValues).values({ profileId: profile.id, field: 'name', value: 'X', source: 'manual', confirmedByKind: 'citizen', confirmedById: user.id });
    await db.insert(t.overrides).values({ profileId: profile.id, documentId: doc.id, field: 'name', decision: 'accepted_equivalent', reason: 'r', actorKind: 'citizen', actorId: user.id });
    await db.insert(t.analysisRuns).values({ profileId: profile.id, kbVersion: 'k', issueCount: 0, result: {} });
    await db.insert(t.consents).values({ userId: user.id, purpose: 'full_check', noticeVersion: '1', locale: 'en' });
    await writeAudit(db, { actorKind: 'citizen', actorId: user.id, action: 'account.deleted' });

    await db.delete(t.users).where(eq(t.users.id, user.id));
    for (const table of [t.citizenProfiles, t.documents, t.documentFields, t.documentVersions, t.uploads, t.ocrExtractions, t.masterValues, t.overrides, t.analysisRuns, t.consents]) {
      const rows = await db.select().from(table as typeof t.documents);
      expect(JSON.stringify(rows)).not.toContain(user.id);
      expect(JSON.stringify(rows)).not.toContain(profile.id);
      expect(JSON.stringify(rows)).not.toContain(doc.id);
    }
    const audit = await db.select().from(t.auditLogs).where(eq(t.auditLogs.actorId, user.id));
    expect(audit.length).toBe(1);
  });
});

describe('M15 access and audit', () => {
  const perms = loadExample<{ cases: { roles: string[]; permission: string; allowed: boolean }[] }>('M15', 'M15-EX-permissions');
  it.each(perms.cases)('@M15-AC-1.1 M15-EX-permissions $roles → $permission = $allowed', (c) => {
    expect(can(c.roles, c.permission as never)).toBe(c.allowed);
  });

  it('@M15-AC-2.1 M15-EX-masking', () => {
    const ex = loadExample<{ cases: { kind: string; number?: string; last4?: string; masked: string }[] }>('M15', 'M15-EX-masking');
    for (const c of ex.cases) expect(c.last4 ? maskAadhaar(c.last4) : maskNumber(c.number!), c.kind).toBe(c.masked);
  });

  it('@M15-AC-3.1 @M15-AC-3.2 @M15-AC-3.3 hash-chained, append-only, verifiable; tampering is detected', async () => {
    const db2 = await freshDatabase();
    const { db } = db2;
    for (let i = 0; i < 5; i++) await writeAudit(db, { actorKind: 'system', action: 'test.event', details: { i, nested: { b: 1, a: [2, 1] } } });
    expect(await verifyAuditChain(db)).toEqual({ ok: true, count: 5 });
    const [first] = await db.select().from(t.auditLogs).limit(1);
    expect(first!.prevHash).toBe('0'.repeat(64));
    expect(first!.hash).toMatch(/^[0-9a-f]{64}$/);
    await expect(db.update(t.auditLogs).set({ action: 'x' })).rejects.toThrow();
    await expect(db.delete(t.auditLogs)).rejects.toThrow();
    // Tampering outside the application (trigger bypassed) is caught by verification.
    await db.execute(sql`ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_update`);
    await db.execute(sql`UPDATE audit_logs SET details = '{"i": 99}'::jsonb WHERE id = 3`);
    expect(await verifyAuditChain(db)).toEqual({ ok: false, count: 2, brokenAt: 3 });
    await db2.close();
  });

  it('@M15-AC-4.1 the retention job purges due uploads only, and audits each purge', async () => {
    const { db } = database;
    const store = new EncryptedStore(new MemoryRawStore(), testKeyring());
    const { doc } = await makeCitizenWithDocument(db);
    const now = new Date('2026-12-01T00:00:00Z');
    const dueKey = crypto.randomUUID();
    const laterKey = crypto.randomUUID();
    await store.put(dueKey, Buffer.from('due'));
    await store.put(laterKey, Buffer.from('later'));
    const [due] = await db.insert(t.uploads).values({ documentId: doc.id, storageKey: dueKey, mime: 'image/png', sizeBytes: 3, sha256: 'a', purgeAfter: new Date('2026-11-30T00:00:00Z') }).returning();
    await db.insert(t.uploads).values({ documentId: doc.id, storageKey: laterKey, mime: 'image/png', sizeBytes: 5, sha256: 'b', purgeAfter: new Date('2026-12-31T00:00:00Z') });
    expect(await purgeDueUploads(db, store, now)).toBe(1);
    expect(await store.exists(dueKey)).toBe(false);
    expect(await store.exists(laterKey)).toBe(true);
    const [row] = await db.select().from(t.uploads).where(eq(t.uploads.id, due!.id));
    expect(row!.purgedAt?.toISOString()).toBe(now.toISOString());
    const events = await db.select().from(t.auditLogs).where(eq(t.auditLogs.action, 'retention.upload_purged'));
    expect(events.map((e) => e.subjectId)).toContain(due!.id);
    expect(await purgeDueUploads(db, store, now)).toBe(0);
  });
});

describe('F05 citizen sign-in', () => {
  const pepper = 'test-pepper';

  it('@F05-AC-1.1 F05-EX-mobiles', () => {
    const ex = loadExample<{ valid: { input: string; normalised: string }[]; invalid: string[] }>('F05', 'F05-EX-mobiles');
    for (const v of ex.valid) expect(normaliseMobile(v.input), v.input).toBe(v.normalised);
    for (const v of ex.invalid) expect(normaliseMobile(v), v).toBeNull();
  });

  it('@F05-AC-1.2 @F05-AC-1.4 a correct code signs in once (account created on first use); only a hash is stored', async () => {
    const { db } = database;
    const sender = new DevOutboxSender(db);
    const now = new Date('2026-11-02T10:00:00Z');
    expect(await requestCode({ db, sender, pepper, now }, '98450 12345')).toEqual({ ok: true, mobile: '+919845012345' });
    const msg = await latestOutboxMessage(db, '+919845012345');
    const code = /(\d{6})/.exec(msg!.body)![1]!;
    const [challenge] = await db.select().from(t.otpChallenges).where(eq(t.otpChallenges.mobile, '+919845012345'));
    expect(JSON.stringify(challenge)).not.toContain(code);
    const first = await verifyCode({ db, sender, pepper, now: new Date(now.getTime() + 60_000) }, '+919845012345', code);
    expect(first).toMatchObject({ ok: true, isNew: true });
    const again = await verifyCode({ db, sender, pepper, now: new Date(now.getTime() + 61_000) }, '+919845012345', code);
    expect(again).toEqual({ ok: false, error: 'expired' });
  });

  it('@F05-AC-1.3 codes expire, attempts are limited, and requests are rate-limited', async () => {
    const { db } = database;
    const sender = new DevOutboxSender(db);
    const t0 = new Date('2026-11-03T10:00:00Z');
    const mobile = '+919900011122';
    await requestCode({ db, sender, pepper, now: t0 }, mobile);
    expect(await requestCode({ db, sender, pepper, now: new Date(t0.getTime() + 10_000) }, mobile)).toEqual({ ok: false, error: 'too_soon' });
    const code = /(\d{6})/.exec((await latestOutboxMessage(db, mobile))!.body)![1]!;
    expect(await verifyCode({ db, sender, pepper, now: new Date(t0.getTime() + OTP_TTL_MS + 1) }, mobile, code)).toEqual({ ok: false, error: 'expired' });

    const t1 = new Date(t0.getTime() + 60_000);
    await requestCode({ db, sender, pepper, now: t1 }, mobile);
    const wrong = (await latestOutboxMessage(db, mobile))!.body.includes('000000') ? '111111' : '000000';
    for (let i = 0; i < 4; i++) expect((await verifyCode({ db, sender, pepper, now: t1 }, mobile, wrong)).ok).toBe(false);
    expect(await verifyCode({ db, sender, pepper, now: t1 }, mobile, wrong)).toEqual({ ok: false, error: 'too_many_attempts' });
    const right = /(\d{6})/.exec((await latestOutboxMessage(db, mobile))!.body)![1]!;
    expect(await verifyCode({ db, sender, pepper, now: t1 }, mobile, right)).toEqual({ ok: false, error: 'too_many_attempts' });

    for (let i = 2; i <= 4; i++) await requestCode({ db, sender, pepper, now: new Date(t0.getTime() + i * 60_000) }, mobile);
    expect(await requestCode({ db, sender, pepper, now: new Date(t0.getTime() + 5 * 60_000) }, mobile)).toEqual({ ok: false, error: 'too_many' });
  });

  it('@F05-AC-4.1 the development outbox is refused in production', () => {
    expect(() => createOtpSender('dev-outbox', 'production', database.db)).toThrow(/not allowed/);
    expect(createOtpSender('dev-outbox', 'development', database.db).name).toBe('dev-outbox');
    expect(() => loadConfig({ APP_ENV: 'production', DATABASE_URL: 'postgres://x', DATA_KEYS: `k:${generateKey()}`, DATA_KEY_CURRENT: 'k', OTP_PEPPER: 'x'.repeat(32), OTP_SENDER: 'dev-outbox' })).toThrow(/not allowed/);
  });
});

describe('F05 staff sign-in', () => {
  it('@F05-AC-2.2 F05-EX-totp — RFC 6238 vectors; ±1 window; no replay', () => {
    const ex = loadExample<{ secretAscii: string; cases: { time: number; code: string }[] }>('F05', 'F05-EX-totp');
    const secret = Buffer.from(ex.secretAscii, 'ascii');
    for (const c of ex.cases) expect(totpAt(secret, Math.floor(c.time / 30)), String(c.time)).toBe(c.code);
    const b32 = base32Encode(secret);
    const t = 1_111_111_111;
    const prev = totpAt(secret, Math.floor(t / 30) - 1);
    expect(verifyTotp(b32, prev, t, null)).toBe(Math.floor(t / 30) - 1);
    expect(verifyTotp(b32, prev, t, Math.floor(t / 30) - 1)).toBeNull();
    expect(verifyTotp(b32, totpAt(secret, Math.floor(t / 30) - 2), t, null)).toBeNull();
  });

  it('@F05-AC-2.4 passwords are scrypt-hashed with a salt; short ones are refused', async () => {
    const h1 = await hashPassword('correct horse battery');
    const h2 = await hashPassword('correct horse battery');
    expect(h1).not.toBe(h2);
    expect(h1).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(await verifyPassword('correct horse battery', h1)).toBe(true);
    expect(await verifyPassword('wrong horse battery', h1)).toBe(false);
    await expect(createStaff(database.db, { email: 'short@iic.test', name: 'S', password: 'short', roles: [] }, { kind: 'system', id: null })).rejects.toThrow(/12 characters/);
  });

  it('@F05-AC-2.1 without 2FA a staff member can only enrol; with it, a TOTP code is required', async () => {
    const { db } = database;
    const keyring = testKeyring();
    const id = await createStaff(db, { email: 'Volunteer@IIC.test', name: 'Sana M.', password: 'a long enough password', roles: ['volunteer'] }, { kind: 'system', id: null });
    const now = new Date('2026-11-02T09:00:00Z');
    const first = await staffSignIn(db, 'volunteer@iic.test', 'a long enough password', now);
    expect(first).toMatchObject({ ok: true, needsEnrolment: true });
    if (!first.ok) throw new Error();
    let session = await resolveSession(db, first.token, now);
    expect(session).toMatchObject({ kind: 'staff', mfaVerified: false });
    const { secret, uri } = await beginTotpEnrolment(db, keyring, id);
    expect(uri).toContain('otpauth://totp/');
    const [stored] = await db.select().from(t.staffUsers).where(eq(t.staffUsers.id, id));
    expect(stored!.totpSecret).not.toContain(secret);
    const code = totpAt(base32Decode(secret), Math.floor(now.getTime() / 30_000));
    expect(await verifyStaffTotp(db, keyring, id, first.token, code, now)).toEqual({ ok: true });
    session = await resolveSession(db, first.token, now);
    expect(session).toMatchObject({ kind: 'staff', mfaVerified: true, roles: ['volunteer'] });

    const second = await staffSignIn(db, 'volunteer@iic.test', 'a long enough password', new Date(now.getTime() + 60_000));
    expect(second).toMatchObject({ ok: true, needsEnrolment: false });
  });

  it('@F05-AC-2.3 five failures lock the account for 15 minutes without checking the password', async () => {
    const { db } = database;
    await createStaff(db, { email: 'lock@iic.test', name: 'L', password: 'the right password', roles: ['admin'] }, { kind: 'system', id: null });
    const now = new Date('2026-11-02T09:00:00Z');
    for (let i = 0; i < 5; i++) expect(await staffSignIn(db, 'lock@iic.test', 'wrong password!!', now)).toEqual({ ok: false, error: 'invalid' });
    expect(await staffSignIn(db, 'lock@iic.test', 'the right password', new Date(now.getTime() + 60_000))).toEqual({ ok: false, error: 'locked' });
    expect((await staffSignIn(db, 'lock@iic.test', 'the right password', new Date(now.getTime() + 16 * 60_000))).ok).toBe(true);
  });
});

describe('F05 sessions', () => {
  it('@F05-AC-3.1 F05-EX-sessions — idle and maximum lifetimes', async () => {
    const ex = loadExample<{ citizen: { idleHours: number; maxDays: number }; staff: { idleMinutes: number; maxHours: number } }>('F05', 'F05-EX-sessions');
    expect(SESSION_POLICY.citizen).toEqual({ idleMs: ex.citizen.idleHours * 3_600_000, maxMs: ex.citizen.maxDays * 86_400_000 });
    expect(SESSION_POLICY.staff).toEqual({ idleMs: ex.staff.idleMinutes * 60_000, maxMs: ex.staff.maxHours * 3_600_000 });
    const { db } = database;
    const { user } = await makeCitizenWithDocument(db);
    const t0 = new Date('2026-11-02T00:00:00Z');
    const idle = await createSession(db, { kind: 'citizen', userId: user.id }, t0);
    expect(await resolveSession(db, idle, new Date(t0.getTime() + 71 * 3_600_000))).not.toBeNull();
    expect(await resolveSession(db, idle, new Date(t0.getTime() + 71 * 3_600_000 + 73 * 3_600_000))).toBeNull();
    const old = await createSession(db, { kind: 'citizen', userId: user.id }, t0);
    for (let h = 48; h <= 14 * 24; h += 48) await resolveSession(db, old, new Date(t0.getTime() + h * 3_600_000));
    expect(await resolveSession(db, old, new Date(t0.getTime() + 14 * 86_400_000 + 1))).toBeNull();
  });

  it('@F05-AC-3.2 @M15-AC-1.3 suspending or offboarding staff revokes their sessions at once', async () => {
    const { db } = database;
    const id = await createStaff(db, { email: 'leaver@iic.test', name: 'Leaver', password: 'a long enough password', roles: ['volunteer'] }, { kind: 'system', id: null });
    const token = await createSession(db, { kind: 'staff', staffId: id, mfaVerified: true });
    expect(await resolveSession(db, token)).not.toBeNull();
    await setStaffStatus(db, id, 'offboarded', { kind: 'system', id: null });
    expect(await resolveSession(db, token)).toBeNull();
    await expect(setStaffStatus(db, id, 'active', { kind: 'system', id: null })).rejects.toThrow(/final/);
  });

  it('@F05-AC-3.3 @F05-AC-3.4 only the token hash is stored; signing out revokes the session', async () => {
    const { db } = database;
    const { user } = await makeCitizenWithDocument(db);
    const token = await createSession(db, { kind: 'citizen', userId: user.id });
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const rows = await db.select().from(t.sessions).where(eq(t.sessions.userId, user.id));
    expect(rows.map((r) => r.id)).toEqual([sha256Hex(token)]);
    await revokeSessionByToken(db, token);
    expect(await resolveSession(db, token)).toBeNull();
  });

  it('@M15-AC-1.2 a citizen session is never a staff session', async () => {
    const { db } = database;
    const { user } = await makeCitizenWithDocument(db);
    const token = await createSession(db, { kind: 'citizen', userId: user.id });
    const s = await resolveSession(db, token);
    expect(s?.kind).toBe('citizen');
    expect(s && 'roles' in s).toBe(false);
  });
});

describe('F07 encryption and storage', () => {
  it('@F07-AC-1.1 F07-EX-envelope — AES-256-GCM values and files; tampering and wrong keys fail', () => {
    const ex = loadExample<{ pattern: string }>('F07', 'F07-EX-envelope');
    const keyring = testKeyring('key-a');
    const env = encryptValue('ABCPE1234F', keyring);
    expect(env).toMatch(new RegExp(ex.pattern));
    expect(env).not.toContain('ABCPE1234F');
    expect(decryptValue(env, keyring)).toBe('ABCPE1234F');
    const parts = env.split('.');
    parts[4] = Buffer.from('tampered').toString('base64url');
    expect(() => decryptValue(parts.join('.'), keyring)).toThrow();
    expect(() => decryptValue(env, testKeyring('key-a'))).toThrow();
    const blob = encryptBytes(Buffer.from('%PDF-1.7 file'), keyring);
    expect(blob.includes(Buffer.from('%PDF'))).toBe(false);
    expect(decryptBytes(blob, keyring).toString()).toBe('%PDF-1.7 file');
  });

  it('@F07-AC-1.2 rotation: new data uses the current key; old data still decrypts', () => {
    const k1 = generateKey();
    const k2 = generateKey();
    const old = parseKeyring(`k1:${k1}`, 'k1');
    const rotated = parseKeyring(`k1:${k1},k2:${k2}`, 'k2');
    const before = encryptValue('secret', old);
    const after = encryptValue('secret', rotated);
    expect(after.split('.')[1]).toBe('k2');
    expect(decryptValue(before, rotated)).toBe('secret');
  });

  it('@F07-AC-1.3 production refuses to start without valid keys; development creates a local key file', () => {
    expect(() => loadConfig({ APP_ENV: 'production', DATABASE_URL: 'postgres://x', OTP_PEPPER: 'x'.repeat(32), OTP_SENDER: 'sms' })).toThrow(/DATA_KEYS/);
    expect(() => loadConfig({ APP_ENV: 'production', DATABASE_URL: 'postgres://x', DATA_KEYS: 'k:c2hvcnQ=', DATA_KEY_CURRENT: 'k', OTP_PEPPER: 'x'.repeat(32), OTP_SENDER: 'sms' })).toThrow(/32 bytes/);
    const dir = mkdtempSync(join(tmpdir(), 'idcfg-'));
    const c = loadConfig({ APP_ENV: 'development', DATA_DIR: dir });
    expect(c.keyring.current).toBe('dev-1');
    expect(existsSync(`${dir}/dev-keys.json`)).toBe(true);
  });

  it('@F07-AC-3.1 F07-EX-types — uploads are judged by content', () => {
    const ex = loadExample<{ accepted: { name: string; firstBytesHex: string; mime: string }[]; refused: { name: string; firstBytesHex: string }[]; maxBytes: number }>('F07', 'F07-EX-types');
    for (const a of ex.accepted) expect(sniffType(Buffer.from(a.firstBytesHex.padEnd(16, '0'), 'hex')), a.name).toBe(a.mime);
    for (const r of ex.refused) expect(sniffType(Buffer.from(r.firstBytesHex.padEnd(16, '0'), 'hex')), r.name).toBeNull();
    expect(MAX_UPLOAD_BYTES).toBe(ex.maxBytes);
  });
});

describe('F02/F01 knowledge base in the database', () => {
  it('seeds once and loads back the same content', async () => {
    const db2 = await freshDatabase();
    expect(await seedKnowledgeBaseIfEmpty(db2.db, seedKnowledgeBase)).toBe(true);
    expect(await seedKnowledgeBaseIfEmpty(db2.db, seedKnowledgeBase)).toBe(false);
    const { kb, version } = await loadKnowledgeBase(db2.db);
    expect(version).toMatch(/^kb-[0-9a-f]{12}$/);
    const sortById = <T extends { id?: string; kind?: string; code?: string }>(xs: T[]) => [...xs].sort((a, b) => String(a.id ?? a.kind ?? a.code).localeCompare(String(b.id ?? b.kind ?? b.code)));
    expect(sortById(kb.rules)).toEqual(sortById(seedKnowledgeBase.rules));
    expect(sortById(kb.catalogue)).toEqual(sortById(seedKnowledgeBase.catalogue));
    expect(kb.placeVariants).toEqual(seedKnowledgeBase.placeVariants);
    await db2.close();
  });

  it('F01-FR-11 effective version: published beats newer drafts; in review used only without a published one; withdrawn removes', () => {
    const row = (version: number, status: 'draft' | 'in_review' | 'published' | 'withdrawn') => ({ kind: 'rule', key: 'r', version, status, data: {}, note: null, createdById: null, createdAt: new Date() });
    expect(effectiveVersion([row(1, 'published'), row(2, 'draft')])?.version).toBe(1);
    expect(effectiveVersion([row(1, 'published'), row(2, 'in_review')])?.version).toBe(1);
    expect(effectiveVersion([row(1, 'in_review'), row(2, 'draft')])?.version).toBe(1);
    expect(effectiveVersion([row(1, 'published'), row(2, 'published')])?.version).toBe(2);
    expect(effectiveVersion([row(1, 'published'), row(2, 'withdrawn')])).toBeNull();
    expect(effectiveVersion([row(1, 'draft')])).toBeNull();
  });
});
