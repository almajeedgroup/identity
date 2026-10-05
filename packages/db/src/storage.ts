/** F07 · Encrypted object storage behind one interface; files are never public. */
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decryptBytes, encryptBytes, type Keyring } from './crypto';

export interface ObjectStore {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

const SAFE_KEY = /^[a-f0-9-]{36}$/;
const checkKey = (key: string) => {
  if (!SAFE_KEY.test(key)) throw new Error('Storage keys are UUIDs (F07-FR-03)');
};

export class MemoryRawStore implements ObjectStore {
  readonly objects = new Map<string, Buffer>();
  async put(key: string, bytes: Uint8Array) {
    checkKey(key);
    this.objects.set(key, Buffer.from(bytes));
  }
  async get(key: string) {
    return this.objects.get(key) ?? null;
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
  async exists(key: string) {
    return this.objects.has(key);
  }
}

export class FsRawStore implements ObjectStore {
  constructor(private readonly dir: string) {}
  private path(key: string) {
    checkKey(key);
    return join(this.dir, key.slice(0, 2), key);
  }
  async put(key: string, bytes: Uint8Array) {
    const p = this.path(key);
    await mkdir(join(this.dir, key.slice(0, 2)), { recursive: true, mode: 0o700 });
    await writeFile(p, bytes, { mode: 0o600 });
  }
  async get(key: string) {
    try {
      return await readFile(this.path(key));
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    await rm(this.path(key), { force: true });
  }
  async exists(key: string) {
    try {
      await stat(this.path(key));
      return true;
    } catch {
      return false;
    }
  }
}

/** Encrypts on the way in, decrypts on the way out (F07-AC-1.1). */
export class EncryptedStore implements ObjectStore {
  constructor(
    readonly raw: ObjectStore,
    private readonly keyring: Keyring,
  ) {}
  async put(key: string, bytes: Uint8Array) {
    await this.raw.put(key, encryptBytes(bytes, this.keyring));
  }
  async get(key: string) {
    const blob = await this.raw.get(key);
    return blob ? decryptBytes(blob, this.keyring) : null;
  }
  delete(key: string) {
    return this.raw.delete(key);
  }
  exists(key: string) {
    return this.raw.exists(key);
  }
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export type UploadMime = 'image/jpeg' | 'image/png' | 'application/pdf';

/** F07-AC-3.1 · decide by content, never by name or declared type. */
export function sniffType(bytes: Uint8Array): UploadMime | null {
  const b = Buffer.from(bytes.subarray(0, 8));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}
