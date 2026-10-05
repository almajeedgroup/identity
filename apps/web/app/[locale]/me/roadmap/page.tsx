import type { CorrectionStep } from '@identity/engine';
import { runFullCheck } from '@identity/services';
import Link from 'next/link';
import { SourceLink } from '@/components/fullcheck/SourceLink';
import { formatInr, formatIsoDate } from '@/i18n/format';
import { PersonBar } from '@/components/fullcheck/PersonBar';
import { requireFullCheck } from '@/lib/server/fullcheck';
import { localeOf, type LocaleParams } from '@/lib/server/page';

export const dynamic = 'force-dynamic';

/** M18 · The correction roadmap: order, reasons, official routes, government fees and the separate service fee (C-01, C-18). */
export default async function RoadmapPage({ params }: { params: LocaleParams }) {
  const { locale, t } = await localeOf(params);
  const { s, userId, person, hasFamily } = await requireFullCheck(locale);
  const [check, { kb }] = await Promise.all([runFullCheck(s, userId, person.id), s.knowledge()]);
  const { roadmap, analysis } = check;
  const kindOf = new Map(analysis.documents.map((d) => [d.id, d.kind]));
  const docLabel = (id: string) => kb.catalogue.find((c) => c.kind === kindOf.get(id))?.label[locale] ?? '';
  const stepNumber = new Map(roadmap.steps.map((step, i) => [step.kind === 'correction' ? step.document : `#${i}`, i + 1]));

  return (
    <div className="space-y-6">
      <h1 className="text-[2rem] leading-tight font-extrabold">{t('roadmap.title')}</h1>
      <PersonBar t={t} locale={locale} person={person} hasFamily={hasFamily} />
      <p>{t('roadmap.intro')}</p>
      {roadmap.warnings.length > 0 && <p className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 font-semibold text-amber-700">{t('roadmap.cycle')}</p>}

      {roadmap.steps.length === 0 ? (
        <p className="card">{t('roadmap.empty')}</p>
      ) : (
        <ol className="space-y-4" data-testid="steps">
          {roadmap.steps.map((step, i) => (
            <li key={i} className="card space-y-3" data-step={step.kind}>
              {step.kind === 'confirm_targets' && (
                <>
                  <h2 className="text-xl font-bold">
                    {i + 1}. {t('roadmap.confirmTargets')}
                  </h2>
                  <p>{t('roadmap.confirmTargetsText', { fields: step.fields.map((f) => t(`fields.${f}`)).join(', ') })}</p>
                  <Link href={`/${locale}/me/report`} className="btn-primary">
                    {t('roadmap.goToReport')}
                  </Link>
                </>
              )}
              {step.kind === 'correction' && <Correction step={step} n={i + 1} />}
              {step.kind === 'recheck' && (
                <>
                  <h2 className="text-xl font-bold">
                    {i + 1}. {t('roadmap.recheck')}
                  </h2>
                  <p>{t('roadmap.recheckText')}</p>
                  <Link href={`/${locale}/me/documents`} className="btn-secondary">
                    {t('me.navDocuments')}
                  </Link>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="rounded-xl border-2 border-coral-500 bg-coral-50 p-4 font-bold text-coral-700" data-testid="otp-warning">
        {t('trust.otpWarning')}
      </p>
    </div>
  );

  function Correction({ step, n }: { step: CorrectionStep; n: number }) {
    const rule = step.rule ? kb.rules.find((r) => r.id === step.rule!.id) : null;
    const authority = step.authority ? kb.authorities.find((a) => a.id === step.authority) : null;
    const sources = step.sources.map((id) => kb.sources.find((src) => src.id === id)).filter((src) => src !== undefined);
    return (
      <>
        <h2 className="text-xl font-bold">
          {n}. {t('roadmap.correct', { document: docLabel(step.document) })}
        </h2>
        <ul className="space-y-1">
          {step.issues.map((issue) => (
            <li key={issue.field} className="font-semibold">
              {t('roadmap.fix', { field: t(`fields.${issue.field}`), from: issue.display || t('report.notEntered'), to: issue.targetDisplay })}
            </li>
          ))}
        </ul>
        <p className="text-slate-500">
          {t(`roadmap.reasons.${step.reason}`)}
          {step.dependsOn.length > 0 && ` ${t('roadmap.after', { documents: step.dependsOn.map((d) => `${stepNumber.get(d) ?? ''}. ${docLabel(d)}`).join(', ') })}`}
        </p>
        {authority && <p>{t('roadmap.authority', { authority: authority.name[locale] })}</p>}
        <p className={`rounded-lg px-3 py-2 text-[0.875rem] font-semibold ${step.verified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`} data-testid="verification">
          {step.verified && step.lastVerified ? t('roadmap.verified', { date: formatIsoDate(step.lastVerified) }) : t('roadmap.unverified')}
        </p>

        {rule ? (
          <details className="space-y-3">
            <summary className="cursor-pointer font-bold text-sky-600">{t('roadmap.steps')}</summary>
            <dl className="mt-2 space-y-3">
              <div>
                <dt className="field-label">{t('roadmap.where')}</dt>
                <dd>{rule.route.where[locale]}</dd>
              </div>
              {rule.route.form && (
                <div>
                  <dt className="field-label">{t('roadmap.form')}</dt>
                  <dd>{rule.route.form}</dd>
                </div>
              )}
              <div>
                <dt className="field-label">{t('roadmap.steps')}</dt>
                <dd>
                  <ol className="list-decimal space-y-1 ps-6">
                    {rule.steps.map((x, k) => (
                      <li key={k}>{x[locale]}</li>
                    ))}
                  </ol>
                </dd>
              </div>
              {rule.requiredDocuments.length > 0 && (
                <div>
                  <dt className="field-label">{t('roadmap.documentsNeeded')}</dt>
                  <dd>
                    <ul className="list-disc space-y-1 ps-6">
                      {rule.requiredDocuments.map((x, k) => (
                        <li key={k}>{x[locale]}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
              {rule.evidence.length > 0 && (
                <div>
                  <dt className="field-label">{t('roadmap.evidence')}</dt>
                  <dd>
                    <ul className="list-disc space-y-1 ps-6">
                      {rule.evidence.map((x, k) => (
                        <li key={k}>{x[locale]}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
              {rule.typicalProcessing && <p>{t('roadmap.processing', { time: rule.typicalProcessing[locale] })}</p>}
            </dl>
          </details>
        ) : (
          <p>{t('roadmap.noRule')}</p>
        )}

        <div className="rounded-xl border border-line-200 p-3" data-testid="government-fee">
          <p className="font-bold">{t('roadmap.govFee')}</p>
          {step.governmentFees.length > 0 ? (
            <ul className="space-y-1">
              {step.governmentFees.map((fee) => (
                <li key={fee.id}>
                  {fee.label[locale]}: {fee.amountInr !== undefined ? formatInr(fee.amountInr) : t('roadmap.govFeeUnknown')}
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('roadmap.govFeeUnknown')}</p>
          )}
          <p className="text-[0.875rem] text-slate-500">{t('roadmap.govFeeNote')}</p>
        </div>

        {sources.length > 0 && (
          <div className="space-y-2">
            <p className="font-bold">{t('roadmap.sources')}</p>
            {sources.map((src) => (
              <SourceLink key={src!.id} url={src!.url} label={src!.title[locale]} t={t} />
            ))}
          </div>
        )}

        <div className="rounded-xl bg-sky-50 p-3" data-testid="service-fee">
          <p className="font-bold">{t('roadmap.serviceTitle')}</p>
          <p>{step.serviceFee ? t('roadmap.serviceFee', { amount: formatInr(step.serviceFee.amountInr) }) : t('roadmap.serviceFeeTbc')}</p>
          <p className="text-[0.875rem]">{t('roadmap.serviceNote')}</p>
          <Link href={`/${locale}/me/help/${step.document}`} className="btn-secondary" data-testid="ask-help">
            {t('roadmap.askHelp')}
          </Link>
        </div>
      </>
    );
  }
}
