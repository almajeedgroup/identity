import { getMyCase, myReceipt } from '@identity/services';
import { notFound } from 'next/navigation';
import { formatInr } from '@/i18n/format';
import { requireFullCheck } from '@/lib/server/fullcheck';
import { formatDate, localeOf, ltr } from '@/lib/server/page';

export const dynamic = 'force-dynamic';

/** M19-FR-04 · A receipt for the 1dentity service fee — explicitly not a government fee. */
export default async function ReceiptPage({ params }: { params: Promise<{ locale: string; id: string; number: string }> }) {
  const { locale, t } = await localeOf(params);
  const { id, number } = await params;
  const { s, userId } = await requireFullCheck(locale);
  const [receipt, c] = await Promise.all([myReceipt(s, userId, id, number), getMyCase(s, userId, id)]);
  if (!receipt || !c) notFound();
  return (
    <article className="card space-y-4" data-testid="receipt">
      <h1 className="text-2xl font-extrabold">{t(receipt.kind === 'payment' ? 'fee.receiptTitle' : 'fee.refundTitle')}</h1>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="field-label">{t('fee.receiptNumber')}</dt>
          <dd className="font-mono" dir="ltr">
            {receipt.number}
          </dd>
        </div>
        <div>
          <dt className="field-label">{t('fee.date')}</dt>
          <dd>{formatDate(receipt.at)}</dd>
        </div>
        <div>
          <dt className="field-label">{t('fee.case')}</dt>
          <dd>{ltr(receipt.caseLabel)}</dd>
        </div>
        <div>
          <dt className="field-label">{t('fee.amount')}</dt>
          <dd className="text-xl font-bold">{formatInr(receipt.amountInr)}</dd>
        </div>
        <div>
          <dt className="field-label">{t('fee.method')}</dt>
          <dd>{t(`fee.methods.${receipt.method}`)}</dd>
        </div>
      </dl>
      <p className="font-semibold">{t('fee.serviceFee')}</p>
      <p className="rounded-xl border-2 border-amber-400 bg-amber-50 p-3 font-bold text-amber-700">{t('fee.receiptNote')}</p>
      <p className="text-slate-500">
        {t('brand.name')} · {t('brand.unit')}
      </p>
    </article>
  );
}
