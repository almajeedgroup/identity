import Link from 'next/link';
import { localeOf, type LocaleParams } from '@/lib/server/page';

/** F06-AC-3.3 · Shown after an account is closed. */
export default async function GoodbyePage({ params }: { params: LocaleParams }) {
  const { locale, t } = await localeOf(params);
  return (
    <div className="space-y-6">
      <p role="status" className="rounded-xl border-2 border-emerald-600 bg-emerald-50 p-4 text-lg font-bold text-emerald-700">
        {t('goodbye.closed')}
      </p>
      <Link href={`/${locale}`} className="btn-secondary">
        {t('help.backHome')}
      </Link>
    </div>
  );
}
