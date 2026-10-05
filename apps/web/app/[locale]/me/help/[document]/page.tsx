import { correctionStepFor } from '@identity/services';
import Link from 'next/link';
import { Banner } from '@/components/fullcheck/Banner';
import { ConsentNotice } from '@/components/fullcheck/ConsentNotice';
import { SubmitButton } from '@/components/fullcheck/SubmitButton';
import { formatInr } from '@/i18n/format';
import { requestHelpAction } from '@/lib/server/actions';
import { requireFullCheck } from '@/lib/server/fullcheck';
import { errorMessage, localeOf, query, type SearchParams } from '@/lib/server/page';

export const dynamic = 'force-dynamic';

/** M04 US1 · Ask 1dentity to help with one correction step. */
export default async function RequestHelpPage({ params, searchParams }: { params: Promise<{ locale: string; document: string }>; searchParams: SearchParams }) {
  const { locale, t } = await localeOf(params);
  const { document } = await params;
  const q = await query(searchParams);
  const { s, userId, consents } = await requireFullCheck(locale);
  const [step, { kb }] = await Promise.all([correctionStepFor(s, userId, document), s.knowledge()]);
  const error = errorMessage(t, q.error);
  const here = `/${locale}/me/help/${document}`;
  if (!step) {
    return (
      <div className="space-y-6">
        <h1 className="text-[2rem] leading-tight font-extrabold">{t('assist.title')}</h1>
        <p className="card">{t('errors.no_correction_step')}</p>
        <Link href={`/${locale}/me/roadmap`} className="btn-secondary">
          {t('me.navRoadmap')}
        </Link>
      </div>
    );
  }
  const label = kb.catalogue.find((c) => c.kind === step.documentKind)?.label[locale] ?? step.documentKind;
  return (
    <div className="space-y-6">
      <h1 className="text-[2rem] leading-tight font-extrabold">{t('assist.title')}</h1>
      <p className="text-lg">{t('assist.intro', { document: label })}</p>
      {error && <Banner tone="error">{error}</Banner>}
      <section className="card space-y-2">
        <h2 className="text-lg font-bold">{t('assist.includedTitle')}</h2>
        <ul className="list-disc space-y-1 ps-6">
          {(['check', 'file', 'track', 'otp'] as const).map((k) => (
            <li key={k} className={k === 'otp' ? 'font-bold' : undefined}>
              {t(`assist.included.${k}`)}
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-3 sm:grid-cols-2" aria-label={t('assist.feesTitle')}>
        <div className="rounded-xl bg-sky-50 p-4" data-testid="service-fee">
          <p className="font-bold">{t('roadmap.serviceTitle')}</p>
          <p>{step.serviceFee ? t('roadmap.serviceFee', { amount: formatInr(step.serviceFee.amountInr) }) : t('roadmap.serviceFeeTbc')}</p>
        </div>
        <div className="rounded-xl border border-line-200 bg-white p-4" data-testid="government-fee">
          <p className="font-bold">{t('roadmap.govFee')}</p>
          {step.governmentFees.length > 0 ? (
            <ul>
              {step.governmentFees.map((f) => (
                <li key={f.id}>
                  {f.label[locale]}: {f.amountInr !== undefined ? formatInr(f.amountInr) : t('roadmap.govFeeUnknown')}
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('roadmap.govFeeUnknown')}</p>
          )}
          <p className="text-[0.875rem] text-slate-500">{t('roadmap.govFeeNote')}</p>
        </div>
      </section>
      {!consents.has('assistance') ? (
        <ConsentNotice t={t} locale={locale} purpose="assistance" next={here} />
      ) : (
        <form action={requestHelpAction} className="card space-y-5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="document" value={document} />
          <fieldset className="space-y-2">
            <legend className="mb-2 font-bold">{t('assist.modeTitle')}</legend>
            {(['desk', 'whatsapp_video', 'doorstep'] as const).map((m, i) => (
              <label key={m} className="choice">
                <input type="radio" name="mode" value={m} defaultChecked={i === 0} required />
                <span>
                  <span className="block font-bold">{t(`assist.mode.${m}`)}</span>
                  <span className="block text-[0.875rem] text-slate-500">{t(`assist.modeHint.${m}`)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-bold">{t('assist.priorityTitle')}</legend>
            <p className="text-[0.875rem] text-slate-500">{t('assist.priorityHint')}</p>
            {(['age60', 'disability', 'deadline'] as const).map((p) => (
              <label key={p} className="choice">
                <input type="checkbox" name="priority" value={p} />
                <span>{t(`assist.priority.${p}`)}</span>
              </label>
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="deadline">
                  {t('assist.deadline')}
                </label>
                <input id="deadline" name="deadline" type="date" className="field-input" />
              </div>
              <div>
                <label className="field-label" htmlFor="deadline_note">
                  {t('assist.deadlineNote')}
                </label>
                <input id="deadline_note" name="deadline_note" className="field-input" maxLength={120} />
              </div>
            </div>
          </fieldset>
          <label className="choice">
            <input type="checkbox" name="sms" value="yes" defaultChecked={consents.has('sms')} />
            <span>{t('assist.sms')}</span>
          </label>
          <SubmitButton>{t('assist.submit')}</SubmitButton>
        </form>
      )}
      <Link href={`/${locale}/me/roadmap`} className="btn-quiet">
        {t('assist.diy')}
      </Link>
    </div>
  );
}
