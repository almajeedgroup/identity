/** F05-FR-03 · One-time code delivery through a sender interface (ADR-014). */
import { and, desc, eq } from 'drizzle-orm';
import type { Db } from './client';
import { devOutbox } from './schema';

export interface OtpSender {
  readonly name: string;
  send(to: string, body: string): Promise<void>;
}

export class DevOutboxSender implements OtpSender {
  readonly name = 'dev-outbox';
  constructor(private readonly db: Db) {}
  async send(to: string, body: string) {
    await this.db.insert(devOutbox).values({ channel: 'sms', recipient: to, body });
  }
}

/** F05-AC-4.1 */
export function createOtpSender(name: string, appEnv: string, db: Db): OtpSender {
  if (name === 'dev-outbox') {
    if (appEnv === 'production') throw new Error('OTP_SENDER=dev-outbox is not allowed when APP_ENV=production');
    return new DevOutboxSender(db);
  }
  throw new Error(`Unknown OTP_SENDER "${name}" — choose a provider in ADR-005`);
}

export async function latestOutboxMessage(db: Db, recipient: string) {
  const [row] = await db.select().from(devOutbox).where(and(eq(devOutbox.recipient, recipient), eq(devOutbox.channel, 'sms'))).orderBy(desc(devOutbox.createdAt)).limit(1);
  return row ?? null;
}
