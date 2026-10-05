import 'server-only';
import { mkdirSync } from 'node:fs';
import { seedKnowledgeBase } from '@identity/content';
import {
  createOtpSender,
  EncryptedStore,
  FsRawStore,
  loadConfig,
  loadKnowledgeBase,
  MemoryRawStore,
  migrate,
  openDatabase,
  pruneOtpChallenges,
  purgeDueUploads,
  seedKnowledgeBaseIfEmpty,
  type Db,
  type OtpSender,
  type PlatformConfig,
} from '@identity/db';
import { createContext } from '@identity/engine';
import { PdfTextProvider, TesseractProvider } from '@identity/ocr';
import type { Knowledge, Services } from '@identity/services';

/**
 * One platform per server process (ADR-011, ADR-013, ADR-014): configuration, database (migrated and seeded),
 * encrypted object store, one-time-code sender and OCR providers. Kept on globalThis so every route shares it.
 */
export interface Platform {
  config: PlatformConfig;
  db: Db;
  otp: OtpSender;
  services: Services;
}

const KNOWLEDGE_TTL_MS = 30_000;
const HOUSEKEEPING_MS = 60 * 60_000;

const g = globalThis as typeof globalThis & { __identityPlatform?: Promise<Platform> };

export function platform(): Promise<Platform> {
  g.__identityPlatform ??= boot().catch((error: unknown) => {
    g.__identityPlatform = undefined;
    throw error;
  });
  return g.__identityPlatform;
}

async function boot(): Promise<Platform> {
  const config = loadConfig();
  if (!config.databaseUrl && config.pgliteDir !== 'memory://') mkdirSync(config.pgliteDir, { recursive: true, mode: 0o700 });
  const { db } = await openDatabase({ ...(config.databaseUrl ? { url: config.databaseUrl } : {}), pgliteDir: config.pgliteDir });
  await migrate(db);
  await seedKnowledgeBaseIfEmpty(db, seedKnowledgeBase);

  const raw = config.storageDir === 'memory://' ? new MemoryRawStore() : new FsRawStore(config.storageDir);
  const store = new EncryptedStore(raw, config.keyring);

  let cached: { at: number; value: Knowledge } | null = null;
  const knowledge = async (): Promise<Knowledge> => {
    if (cached && Date.now() - cached.at < KNOWLEDGE_TTL_MS) return cached.value;
    const { kb, version } = await loadKnowledgeBase(db);
    cached = { at: Date.now(), value: { kb, version, ctx: createContext(kb) } };
    return cached.value;
  };

  const services: Services = { db, keyring: config.keyring, store, ocr: { image: new TesseractProvider(), pdf: new PdfTextProvider() }, knowledge };

  // F06-FR-04 · retention: uploads 30 days after verification, sign-in codes 1 day.
  const housekeeping = async () => {
    try {
      await purgeDueUploads(db, store);
      await pruneOtpChallenges(db);
    } catch (error) {
      console.error('Housekeeping failed', error);
    }
  };
  void housekeeping();
  setInterval(housekeeping, HOUSEKEEPING_MS).unref();

  return { config, db, otp: createOtpSender(config.otpSender, config.appEnv, db), services };
}
