/** Platform configuration from the environment; production refuses unsafe defaults (F05-AC-4.1, F07-AC-1.3). */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateKey, parseKeyring, type Keyring } from './crypto';

export interface PlatformConfig {
  appEnv: 'development' | 'test' | 'staging' | 'production';
  databaseUrl?: string;
  pgliteDir: string;
  keyring: Keyring;
  otpPepper: string;
  otpSender: string;
  storageDir: string;
  secureCookies: boolean;
}

export function loadConfig(env: Record<string, string | undefined> = process.env, cwd: string = process.cwd()): PlatformConfig {
  const appEnv = (env.APP_ENV ?? 'development') as PlatformConfig['appEnv'];
  if (!['development', 'test', 'staging', 'production'].includes(appEnv)) throw new Error(`Unknown APP_ENV "${appEnv}"`);
  const production = appEnv === 'production';
  const dataDir = env.DATA_DIR ?? join(cwd, '.data');

  let keysSpec = env.DATA_KEYS;
  let current = env.DATA_KEY_CURRENT;
  let pepper = env.OTP_PEPPER;
  if (production) {
    if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required when APP_ENV=production');
    if (!keysSpec || !current) throw new Error('DATA_KEYS and DATA_KEY_CURRENT are required when APP_ENV=production');
    if (!pepper || pepper.length < 32) throw new Error('OTP_PEPPER (32+ characters) is required when APP_ENV=production');
  } else if (!keysSpec || !current || !pepper) {
    // Development: a local key file, never committed (.data is git-ignored).
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    const file = join(dataDir, 'dev-keys.json');
    if (!existsSync(file)) writeFileSync(file, JSON.stringify({ keys: `dev-1:${generateKey()}`, current: 'dev-1', pepper: generateKey() }), { mode: 0o600 });
    const dev = JSON.parse(readFileSync(file, 'utf8')) as { keys: string; current: string; pepper: string };
    keysSpec ??= dev.keys;
    current ??= dev.current;
    pepper ??= dev.pepper;
  }
  const otpSender = env.OTP_SENDER ?? (production ? '' : 'dev-outbox');
  if (production && otpSender === 'dev-outbox') throw new Error('OTP_SENDER=dev-outbox is not allowed when APP_ENV=production');
  return {
    appEnv,
    ...(env.DATABASE_URL ? { databaseUrl: env.DATABASE_URL } : {}),
    pgliteDir: env.PGLITE_DIR ?? join(dataDir, 'pglite'),
    keyring: parseKeyring(keysSpec!, current!),
    otpPepper: pepper!,
    otpSender,
    storageDir: env.STORAGE_DIR ?? join(dataDir, 'objects'),
    secureCookies: (env.APP_URL ?? '').startsWith('https://'),
  };
}
