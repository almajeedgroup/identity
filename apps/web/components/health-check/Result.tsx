'use client';

import { resolveFees, type ContentBundle, type DocKind, type Field } from '@identity/content';
import type { FieldResult, HealthCheckInput, HealthReport, Issue } from '@identity/rules';
import Link from 'next/link';
import { formatDob } from '@/i18n/format';
import { useI18n } from '@/i18n/I18nProvider';
import { OfficialLink } from '../OfficialLink';
import { ScoreDial } from '../ScoreDial';
import { StatusChip } from '../StatusChip';
import { verificationMessage } from './verification';

const NAME_VARIANT_REASONS = new Set(['spacing', 'initials', 'abbreviation', 'transliteration', 'word_order']);

export type SaveState = 'saved' | 'not_saved' | 'cleared';

export function Result({
  report,
  input,
  bundle,
  asOf,
  saveState,
  onClear,
  onAgain,
}: {
  report: HealthReport;
  input: HealthCheckInput;
  bundle: ContentBundle;
  asOf: string;
  saveState: SaveState;
  onClear: () => void;
  onAgain: () => void;
}) {
  const { locale, t } = useI18n();
  const docLabel = (kind: DocKind) => bundle.documents.find((d) => d.kind === kind)?.label[locale] ?? kind;
  const reasonText = (issue: Issue) =>
    t(`reason.${issue.reason}`, { document: docLabel(issue.document), reference: issue.comparedWith ? docLabel(issue.comparedWith) : '' });
  const hasVariant = report.issues.some((i) => NAME_VARIANT_REASONS.has(i.reason));

  return (
    <div className="space-y-8">
      {/* Summary */}
      <section className="card flex items-center gap-5" aria-labelledby="summary-heading">
        <ScoreDial score={report.score} band={report.band} label={t('result.scoreLabel', { score: report.score })} />
        <div className="space-y-1">
          <p id="summary-heading" className="text-[1.375rem] font-bold" data-testid="score-band">
            {t(`result.band.${report.band}`)}
            {report.issueCount > 0 && <> — {t('common.issues', { count: report.issueCount })}</>}
          </p>
          <p className="text-slate-500">{t('result.checked', { count: report.held.length })}</p>
          <p className="sr-only" data-testid="score">
            {t('result.scoreLabel', { score: report.score })}
          </p>
        </div>
      </section>

      {/* M01-AC-3.2 — one primary action */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {report.issueCount > 0 && (
          <a href="#plan" className="btn-primary">
            {t('result.fix', { count: report.issueCount })}
          </a>
        )}
        <Link href={`/${locale}/help`} className="btn-secondary">
          {t('result.assisted')}
        </Link>
      </div>
      {report.issueCount === 0 && <p className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-700">{t('result.allValid')}</p>}

      {/* Document cards — M01-AC-2.2 */}
      <section aria-labelledby="docs-heading" className="space-y-3">
        <h2 id="docs-heading" className="text-[1.375rem] font-bold">
          {t('result.documents')}
        </h2>
        <ul className="space-y-3">
          {report.held.map((kind) => {
            const status = report.documentStatus[kind] ?? 'valid';
            const first = report.issues.find((i) => i.document === kind);
            return (
              <li key={kind} className="card flex items-start justify-between gap-3" data-testid={`doc-card-${kind}`}>
                <div>
                  <p className="text-lg font-bold">{docLabel(kind)}</p>
                  <p className="text-slate-500">{first ? reasonText(first) : t('result.docValid')}</p>
                </div>
                <StatusChip status={status} label={t(`status.${status}`)} />
              </li>
            );
          })}
        </ul>
      </section>

      {/* Mismatch report — M01-AC-2.3 */}
      {report.held.length >= 2 && <MismatchReport report={report} input={input} docLabel={docLabel} />}

      {/* Action plan — M01-AC-3.1 */}
      {report.actions.length > 0 && (
        <section id="plan" aria-labelledby="plan-heading" className="scroll-mt-4 space-y-3" tabIndex={-1}>
          <h2 id="plan-heading" className="text-[1.375rem] font-bold">
            {t('result.plan')}
          </h2>
          <p className="text-slate-500">{t('result.planIntro')}</p>
          {hasVariant && <p className="rounded-xl bg-amber-50 p-3 text-amber-700">{t('result.variantNote')}</p>}
          <ol className="space-y-4">
            {report.actions.map((planned, index) => {
              const action = bundle.actions.find((a) => a.id === planned.actionId)!;
              const fees = resolveFees(action, asOf);
              const verification = verificationMessage(action.meta, asOf);
              return (
                <li key={action.id} className="card space-y-3" data-testid={`action-${action.id}`}>
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-bold text-white">
                      {index + 1}
                    </span>
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold">{action.title[locale]}</h3>
                      <p>{action.summary[locale]}</p>
                      <p className="text-[0.875rem] text-slate-500">
                        {t('result.fixes', { fields: planned.fields.map((f) => t(`field.${f}`)).join(', ') })}
                      </p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.9375rem]">
                    {action.form && (
                      <>
                        <dt className="font-semibold text-slate-500">{t('result.form')}</dt>
                        <dd className="font-bold" dir="ltr">
                          <bdi>{action.form}</bdi>
                        </dd>
                      </>
                    )}
                    <dt className="font-semibold text-slate-500">{t('result.where')}</dt>
                    <dd>{action.where[locale]}</dd>
                    <dt className="font-semibold text-slate-500">{t('result.fee')}</dt>
                    <dd data-testid="fee">{fees.length ? fees.map((f) => f.label[locale]).join(' · ') : t('result.feeUnknown')}</dd>
                  </dl>
                  <p className="text-[0.8125rem] text-slate-500" data-testid="verification">
                    {t(verification.key, verification.vars)}
                  </p>
                  <div className="space-y-2">
                    {action.links.map((id) => {
                      const link = bundle.links.find((l) => l.id === id);
                      return link ? <OfficialLink key={id} link={link} /> : null;
                    })}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {report.tips.length > 0 && (
        <section aria-labelledby="tips-heading" className="space-y-2">
          <h2 id="tips-heading" className="text-lg font-bold">
            {t('result.tips')}
          </h2>
          <ul className="list-disc space-y-1 ps-6">
            {report.tips.map((tip) => (
              <li key={tip}>{t(`tip.${tip}`)}</li>
            ))}
          </ul>
        </section>
      )}

      <p role="note" className="rounded-xl border-2 border-coral-500 bg-coral-50 p-4 font-bold text-coral-700" data-testid="otp-warning">
        {t('trust.otpWarning')}
      </p>

      <div className="space-y-2 border-t border-line-200 pt-4">
        <p className="text-slate-500" role="status" data-testid="save-state">
          {saveState === 'saved' ? t('result.saved') : saveState === 'cleared' ? t('result.cleared') : t('result.notSaved')}
        </p>
        <div className="flex flex-wrap gap-2">
          {saveState === 'saved' && (
            <button type="button" className="btn-quiet" onClick={onClear}>
              {t('result.clear')}
            </button>
          )}
          <button type="button" className="btn-quiet" onClick={onAgain}>
            {t('result.again')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** M01-AC-2.3 · One block per detail, as in the DPR §07 "Mismatch report" screen: no sideways scrolling on small phones. */
function MismatchReport({ report, input, docLabel }: { report: HealthReport; input: HealthCheckInput; docLabel: (k: DocKind) => string }) {
  const { t } = useI18n();
  const fields: Field[] = (['name', 'dob', 'gender', 'address', 'mobile_link'] as const).filter((f) => report.fieldResults[f] !== undefined);

  const value = (kind: DocKind, field: Field): string => {
    const d = input.documents[kind] ?? {};
    switch (field) {
      case 'name':
        return d.name ?? '';
      case 'dob':
        return d.dob ? formatDob(d.dob) : '';
      case 'gender':
        return d.gender ? t(`check.doc.gender${d.gender[0]!.toUpperCase()}${d.gender.slice(1)}`) : '';
      case 'address':
        return d.locality ?? '';
      case 'mobile_link': {
        const a = input.answers?.mobileLinked;
        return a ? t(`check.situation.${a}`) : '';
      }
      default:
        return '';
    }
  };

  const valueClass: Record<FieldResult, string> = {
    ok: 'font-semibold',
    na: 'text-slate-500',
    mismatch: 'font-bold text-coral-700',
    update_due: 'font-bold text-amber-700',
  };

  return (
    <section aria-labelledby="report-heading" className="space-y-3" data-testid="mismatch-report">
      <h2 id="report-heading" className="text-[1.375rem] font-bold">
        {t('result.report')}
      </h2>
      <ul className="space-y-3">
        {fields.map((field) => {
          const row = report.fieldResults[field]!;
          const docs = report.held.filter((k) => row[k] !== undefined);
          const mismatched = docs.filter((k) => row[k] === 'mismatch');
          const due = docs.filter((k) => row[k] === 'update_due');
          const anyOk = docs.some((k) => row[k] === 'ok');
          return (
            <li key={field} className="card space-y-2" data-testid={`report-${field}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold">{t(`field.${field}`)}</h3>
                {mismatched.length > 0 ? (
                  <StatusChip status="mismatch" label={t('result.mismatchIn', { documents: mismatched.map(docLabel).join(', ') })} />
                ) : due.length > 0 ? (
                  <StatusChip status="update_due" label={t('status.update_due')} />
                ) : anyOk ? (
                  <StatusChip status="ok" label={t('status.ok')} />
                ) : null}
              </div>
              <dl className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-4 gap-y-1">
                {docs.map((k) => {
                  const result = row[k]!;
                  const v = value(k, field);
                  return (
                    <div key={k} className="contents">
                      <dt className="text-slate-500">{docLabel(k)}</dt>
                      <dd className={`break-words ${valueClass[result]}`}>
                        {v ? <bdi>{v}</bdi> : '—'}
                        {(result === 'mismatch' || result === 'update_due') && <span className="sr-only"> ({t(`status.${result}`)})</span>}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
