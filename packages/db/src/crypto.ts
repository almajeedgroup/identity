/** ADR-013 / F07 · AES-256-GCM envelopes, hashing, tokens and password hashing. */
import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

export interface Keyring {
  current: string;
  keys: Map<string, Buffer>;
}

/** `DATA_KEYS` = "id:base64,id2:base64", `DATA_KEY_CURRENT` = id. */
export function parseKeyring(keysSpec: string, current: string): Keyring {
  const keys = new Map<string, Buffer>();
  for (const pair of keysSpec.split(',').map((p) => p.trim()).filter(Boolean)) {
    const [id, b64] = pair.split(':');
    if (!id || !b64 || !/^[a-z0-9-]+$/.test(id)) throw new Error('DATA_KEYS entries must look like "key-id:base64"');
    const key = Buffer.from(b64, 'base64');
    if (key.length !== 32) throw new Error(`Data key "${id}" must be 32 bytes`);
    keys.set(id, key);
  }
  if (!keys.has(current)) throw new Error(`DATA_KEY_CURRENT "${current}" is not in DATA_KEYS`);
  return { current, keys };
}

export function generateKey(): string {
  return randomBytes(32).toString('base64');
}

const b64u = (b: Buffer) => b.toString('base64url');

/** F07-FR-01 · v1.<key id>.<iv>.<tag>.<ciphertext> */
export function encryptValue(plain: string, keyring: Keyring): string {
  const key = keyring.keys.get(keyring.current)!;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1.${keyring.current}.${b64u(iv)}.${b64u(cipher.getAuthTag())}.${b64u(ct)}`;
}

export function decryptValue(envelope: string, keyring: Keyring): string {
  const [v, id, iv, tag, ct] = envelope.split('.');
  if (v !== 'v1' || !id || iv === undefined || tag === undefined || ct === undefined) throw new Error('Not an encrypted value');
  const key = keyring.keys.get(id);
  if (!key) throw new Error(`Unknown data key "${id}"`);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
}

const FILE_MAGIC = Buffer.from('IDF1');

/** Binary envelope for files: "IDF1" | key-id length (1 byte) | key id | iv (12) | tag (16) | ciphertext. */
export function encryptBytes(plain: Uint8Array, keyring: Keyring): Buffer {
  const key = keyring.keys.get(keyring.current)!;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const id = Buffer.from(keyring.current, 'utf8');
  return Buffer.concat([FILE_MAGIC, Buffer.from([id.length]), id, iv, cipher.getAuthTag(), ct]);
}

export function decryptBytes(blob: Uint8Array, keyring: Keyring): Buffer {
  const buf = Buffer.from(blob);
  if (!buf.subarray(0, 4).equals(FILE_MAGIC)) throw new Error('Not an encrypted file');
  const idLen = buf[4]!;
  const id = buf.subarray(5, 5 + idLen).toString('utf8');
  const key = keyring.keys.get(id);
  if (!key) throw new Error(`Unknown data key "${id}"`);
  const iv = buf.subarray(5 + idLen, 17 + idLen);
  const tag = buf.subarray(17 + idLen, 33 + idLen);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buf.subarray(33 + idLen)), decipher.final()]);
}

export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** 32 random bytes, base64url — session tokens (F05-FR-06). */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function constantTimeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---------------------------------------------------------------- passwords (F05-FR-04)

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } satisfies ScryptOptions;
const scrypt = (password: string, salt: Buffer, len: number) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(password, salt, len, SCRYPT, (err, key) => (err ? reject(err) : resolve(key))));

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, keyB64] = stored.split('$');
  if (alg !== 'scrypt' || +n! !== SCRYPT.N || +r! !== SCRYPT.r || +p! !== SCRYPT.p || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}
