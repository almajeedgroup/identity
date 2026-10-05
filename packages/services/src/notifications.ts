/** F08 · In-app notifications and minimal SMS updates (opt-in, quiet hours, retries). */
import { tables, writeAudit } from '@identity/db';
import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { activeConsents, grantConsent, markWithdrawn } from './consents';
import { nowOf, type Services } from './services';

const { notifications, users } = tables;

/** F08-EX-events */
export const NOTIFICATION_KINDS = ['case_received', 'documents_needed', 'appointment_set', 'case_filed', 'with_authority', 'case_completed', 'case_closed', 'recheck', 'verify_upload'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
type SmsKind = Exclude<NotificationKind, 'recheck' | 'verify_upload'>;
type Locale = 'en' | 'kn' | 'hi' | 'ur';

/** F08-FR-02 · {caseId} and {link} only — never names, numbers or document values (F08-AC-2.1). */
export const SMS_TEMPLATES: Record<SmsKind, Record<Locale, string>> = {
  case_received: {
    en: '1dentity: we received your request {caseId}. Follow it here: {link}',
    kn: '1dentity: ನಿಮ್ಮ ವಿನಂತಿ {caseId} ತಲುಪಿದೆ. ಇಲ್ಲಿ ನೋಡಿ: {link}',
    hi: '1dentity: आपका अनुरोध {caseId} मिल गया है। यहाँ देखें: {link}',
    ur: '1dentity: آپ کی درخواست {caseId} موصول ہو گئی ہے۔ یہاں دیکھیں: {link}',
  },
  documents_needed: {
    en: '1dentity: we need something from you for {caseId}. Please open: {link}',
    kn: '1dentity: {caseId} ಗಾಗಿ ನಮಗೆ ನಿಮ್ಮಿಂದ ಏನೋ ಬೇಕು. ದಯವಿಟ್ಟು ತೆರೆಯಿರಿ: {link}',
    hi: '1dentity: {caseId} के लिए हमें आपसे कुछ चाहिए। कृपया खोलें: {link}',
    ur: '1dentity: {caseId} کے لیے ہمیں آپ سے کچھ چاہیے۔ براہ کرم کھولیں: {link}',
  },
  appointment_set: {
    en: '1dentity: an appointment is set for {caseId}. Details: {link}',
    kn: '1dentity: {caseId} ಗಾಗಿ ಭೇಟಿ ನಿಗದಿಯಾಗಿದೆ. ವಿವರಗಳು: {link}',
    hi: '1dentity: {caseId} के लिए मुलाक़ात तय हुई है। विवरण: {link}',
    ur: '1dentity: {caseId} کے لیے ملاقات طے ہو گئی ہے۔ تفصیل: {link}',
  },
  case_filed: {
    en: '1dentity: your application for {caseId} has been filed. Details: {link}',
    kn: '1dentity: {caseId} ಗಾಗಿ ನಿಮ್ಮ ಅರ್ಜಿ ಸಲ್ಲಿಸಲಾಗಿದೆ. ವಿವರಗಳು: {link}',
    hi: '1dentity: {caseId} के लिए आपका आवेदन भर दिया गया है। विवरण: {link}',
    ur: '1dentity: {caseId} کے لیے آپ کی درخواست جمع ہو گئی ہے۔ تفصیل: {link}',
  },
  with_authority: {
    en: '1dentity: {caseId} is now with the issuing office. Details: {link}',
    kn: '1dentity: {caseId} ಈಗ ದಾಖಲೆ ನೀಡುವ ಕಚೇರಿಯಲ್ಲಿದೆ. ವಿವರಗಳು: {link}',
    hi: '1dentity: {caseId} अब जारी करने वाले दफ़्तर के पास है। विवरण: {link}',
    ur: '1dentity: {caseId} اب جاری کرنے والے دفتر کے پاس ہے۔ تفصیل: {link}',
  },
  case_completed: {
    en: '1dentity: {caseId} is completed. Please check your documents again: {link}',
    kn: '1dentity: {caseId} ಪೂರ್ಣಗೊಂಡಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ದಾಖಲೆಗಳನ್ನು ಮತ್ತೆ ಪರಿಶೀಲಿಸಿ: {link}',
    hi: '1dentity: {caseId} पूरा हो गया है। कृपया अपने दस्तावेज़ फिर से जाँचें: {link}',
    ur: '1dentity: {caseId} مکمل ہو گیا ہے۔ براہ کرم اپنے دستاویزات دوبارہ جانچیں: {link}',
  },
  case_closed: {
    en: '1dentity: {caseId} has been closed. Details: {link}',
    kn: '1dentity: {caseId} ಮುಚ್ಚಲಾಗಿದೆ. ವಿವರಗಳು: {link}',
    hi: '1dentity: {caseId} बंद कर दिया गया है। विवरण: {link}',
    ur: '1dentity: {caseId} بند کر دیا گیا ہے۔ تفصیل: {link}',
  },
};

export const isSmsKind = (kind: NotificationKind): kind is SmsKind => kind in SMS_TEMPLATES;
export const MAX_SMS_ATTEMPTS = 3;
export const NOTIFICATION_RETENTION_DAYS = 90;

/** Where a notification points, on 1dentity's own site (F08-FR-03). */
export function notificationLink(appUrl: string, locale: string, n: { caseId?: string | null; kind: string }): string {
  const base = appUrl.replace(/\/+$/, '');
  return n.caseId ? `${base}/${locale}/me/cases/${n.caseId}` : `${base}/${locale}/me/documents`;
}

export function smsText(kind: SmsKind, locale: string, params: { caseId: string; link: string }): string {
  const template = SMS_TEMPLATES[kind][(['en', 'kn', 'hi', 'ur'].includes(locale) ? locale : 'en') as Locale];
  return template.replace('{caseId}', params.caseId).replace('{link}', params.link);
}

/** F08-AC-2.3 · 21:00–08:00 India time. */
export function inQuietHours(at: Date): boolean {
  const hour = new Date(at.getTime() + 330 * 60_000).getUTCHours();
  return hour >= 21 || hour < 8;
}

/**
 * F08-AC-1.1 / 2.1 / 2.2 · Records the notification and, for SMS events with the citizen's opt-in, queues and tries
 * the SMS. Never throws: a notification problem must not undo the action that caused it.
 */
export async function notify(s: Services, input: { userId: string; kind: NotificationKind; caseId?: string; caseLabel?: string; documentId?: string }): Promise<void> {
  try {
    const now = nowOf(s);
    const sms = isSmsKind(input.kind) && (await activeConsents(s.db, input.userId)).has('sms') ? 'pending' : 'none';
    const [row] = await s.db
      .insert(notifications)
      .values({ userId: input.userId, kind: input.kind, caseId: input.caseId ?? null, documentId: input.documentId ?? null, params: input.caseLabel ? { caseId: input.caseLabel } : {}, createdAt: now, sms })
      .returning({ id: notifications.id });
    if (sms === 'pending') await deliverSms(s, now, [row!.id]);
  } catch (error) {
    console.error('Notification failed', error);
  }
}

/** F08-AC-2.3 / 2.4 / F08-FR-04 · Sends pending SMS outside quiet hours; up to 3 attempts. */
export async function deliverSms(s: Services, now: Date = nowOf(s), ids?: string[]): Promise<{ sent: number; failed: number; held: number }> {
  const result = { sent: 0, failed: 0, held: 0 };
  if (!s.messaging) return result;
  const pending = await s.db
    .select({ n: notifications, mobile: users.mobile, locale: users.locale })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId))
    .where(ids?.length ? and(eq(notifications.sms, 'pending'), inArray(notifications.id, ids)) : eq(notifications.sms, 'pending'));
  if (s.messaging.quietHours !== false && inQuietHours(now)) {
    result.held = pending.length;
    return result;
  }
  for (const { n, mobile, locale } of pending) {
    // Only events with a template are ever queued; a missing case label means the case went away.
    const caseLabel = (n.params as { caseId?: string }).caseId;
    if (!isSmsKind(n.kind as NotificationKind) || !caseLabel || !(await activeConsents(s.db, n.userId)).has('sms')) {
      await s.db.update(notifications).set({ sms: 'none' }).where(eq(notifications.id, n.id));
      continue;
    }
    const body = smsText(n.kind as SmsKind, locale, { caseId: caseLabel, link: notificationLink(s.messaging.appUrl, locale, n) });
    try {
      await s.messaging.sender.send(mobile, body);
      await s.db.update(notifications).set({ sms: 'sent', smsSentAt: now, smsAttempts: n.smsAttempts + 1, smsError: null }).where(eq(notifications.id, n.id));
      await writeAudit(s.db, { actorKind: 'system', action: 'notification.sms_sent', subjectKind: 'notification', subjectId: n.id, details: { kind: n.kind } }, now);
      result.sent++;
    } catch (error) {
      const attempts = n.smsAttempts + 1;
      const final = attempts >= MAX_SMS_ATTEMPTS;
      await s.db
        .update(notifications)
        .set({ smsAttempts: attempts, smsError: String((error as Error).message ?? error).slice(0, 200), ...(final ? { sms: 'failed' as const } : {}) })
        .where(eq(notifications.id, n.id));
      if (final) {
        await writeAudit(s.db, { actorKind: 'system', action: 'notification.sms_failed', subjectKind: 'notification', subjectId: n.id, details: { kind: n.kind, attempts } }, now);
        result.failed++;
      }
    }
  }
  return result;
}

export interface NotificationView {
  id: string;
  kind: NotificationKind;
  caseId: string | null;
  caseLabel: string | null;
  createdAt: Date;
  read: boolean;
}

export async function listNotifications(s: Services, userId: string): Promise<NotificationView[]> {
  const rows = await s.db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(100);
  return rows.map((r) => ({ id: r.id, kind: r.kind as NotificationKind, caseId: r.caseId, caseLabel: (r.params as { caseId?: string }).caseId ?? null, createdAt: r.createdAt, read: !!r.readAt }));
}

export async function unreadCount(s: Services, userId: string): Promise<number> {
  const [row] = await s.db
    .select({ n: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return Number(row?.n ?? 0);
}

export async function markAllRead(s: Services, userId: string): Promise<void> {
  await s.db.update(notifications).set({ readAt: nowOf(s) }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

/** F08-AC-3.1 · The SMS opt-in is a consent for the purpose `sms`. */
export async function setSmsUpdates(s: Services, userId: string, on: boolean, locale: string): Promise<void> {
  const active = (await activeConsents(s.db, userId)).has('sms');
  if (on && !active) await grantConsent(s, userId, 'sms', locale);
  if (!on && active) {
    const now = nowOf(s);
    await markWithdrawn(s.db, userId, ['sms'], now);
    await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'consent.withdrawn', details: { purposes: ['sms'] } }, now);
  }
}

/** F08 data table · notifications older than 90 days are deleted. */
export async function purgeOldNotifications(s: Services, now: Date = nowOf(s)): Promise<number> {
  const removed = await s.db
    .delete(notifications)
    .where(lt(notifications.createdAt, new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * 86_400_000)))
    .returning({ id: notifications.id });
  return removed.length;
}
