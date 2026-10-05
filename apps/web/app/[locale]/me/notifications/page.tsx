import { listNotifications, markAllRead } from '@identity/services';
import Link from 'next/link';
import { requireFullCheck } from '@/lib/server/fullcheck';
import { formatDate, localeOf, ltr, type LocaleParams } from '@/lib/server/page';

export const dynamic = 'force-dynamic';

/** F08-AC-1.1 · What changed, newest first; opening the list marks it read. */
export default async function NotificationsPage({ params }: { params: LocaleParams }) {
  const { locale, t } = await localeOf(params);
  const { s, userId } = await requireFullCheck(locale);
  const items = await listNotifications(s, userId);
  await markAllRead(s, userId);
  return (
    <div className="space-y-6">
      <h1 className="text-[2rem] leading-tight font-extrabold">{t('notify.title')}</h1>
      {items.length === 0 ? (
        <p className="card">{t('notify.empty')}</p>
      ) : (
        <ul className="space-y-2" data-testid="notifications">
          {items.map((n) => (
            <li key={n.id} data-kind={n.kind}>
              <Link
                href={n.caseId ? `/${locale}/me/cases/${n.caseId}` : `/${locale}/me/documents`}
                className={`card block text-ink-900 no-underline hover:border-emerald-600 ${n.read ? '' : 'border-emerald-600'}`}
              >
                <span className="block font-semibold">{t(`notify.kind.${n.kind}`, { caseId: ltr(n.caseLabel ?? '') })}</span>
                <span className="block text-[0.875rem] text-slate-500">
                  {formatDate(n.createdAt)}
                  {!n.read && ` · ${t('notify.new')}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/${locale}/me`} className="btn-quiet">
        {t('me.title')}
      </Link>
    </div>
  );
}
