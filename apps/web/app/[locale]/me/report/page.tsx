import { canonicalJson } from '@identity/db';
import { displayValue, type FieldAnalysis, type FieldValue } from '@identity/engine';
import { runFullCheck } from '@identity/services';
import Link from 'next/link';
import { Banner } from '@/components/fullcheck/Banner';
import { SeverityChip } from '@/components/fullcheck/SeverityChip';
import { SubmitButton } from '@/components/fullcheck/SubmitButton';
import type { Translate } from '@/i18n/translate';
import { confirmTargetAction, revokeOverrideAction, setOverrideAction } from '@/lib/server/actions';
import { requireFullCheck } from '@/lib/server/fullcheck';
import { errorMessage, localeOf, query, type LocaleParams, type SearchParams } from '@/lib/server/page';

export const dynamic = 'force-dynamic';

/** Distinct values on the documents, each with the documents showing it — the target choices (M16-AC-2.2). */
function choices(fa: FieldAnalysis): { value: FieldValue; display: string; documents: string[] }[] {
  const out: { value: FieldValue; display: string; documents: string[] }[] = [];
  for (const r of fa.results) {
    if (r.value === null) continue;
    const found = out.find((c) => canonicalJson(c.value) === canonicalJson(r.value));
    if (found) found.documents.push(r.document);
    else out.push({ value: r.value, display: r.display, documents: [r.document] });
  }
  if (fa.suggestion?.reason === 'profile' && !out.some((c) => canonicalJson(c.value) === canonicalJson(fa.suggestion!.value))) {
    out.unshift({ value: fa.suggestion.value, display: fa.suggestion.display, documents: [] });
  }
  return out;
}

/** M02 Part B report with M16 targets and overrides. */
export default async function ReportPage({ params, searchParams }: { params: LocaleParams; searchParams: SearchParams }) {
  const { locale, t } = await localeOf(params);
  const q = await query(searchParams);
  const { s, userId } = await requireFullCheck(locale);
  const [check, { kb }] = await Promise.all([runFullCheck(s, userId), s.knowledge()]);
  const kindOf = new Map(check.analysis.documents.map((d) => [d.id, d.kind]));
  const docLabel = (id: string) => {
    const kind = kindOf.get(id);
    return kb.catalogue.find((c) => c.kind === kind)?.label[locale] ?? '';
  };
  const error = errorMessage(t, q.error);
  const { analysis } = check;

  return (
    <div className="space-y-6">
      <h1 className="text-[2rem] leading-tight font-extrabold">{t('report.title')}</h1>
      <p>{t('report.intro')}</p>
      {error && <Banner tone="error">{error}</Banner>}
      {q.saved && <Banner tone="success">{t('report.targetSaved')}</Banner>}
      {check.pending > 0 && (
        <Banner tone="warning">
          <Link href={`/${locale}/me/documents`}>{t('report.pending', { count: check.pending })}</Link>
        </Banner>
      )}

      {check.resolved.length > 0 && (
        <section className="card space-y-2 border-emerald-600" data-testid="resolved" aria-labelledby="resolved-title">
          <h2 id="resolved-title" className="text-lg font-bold text-emerald-700">
            {t('report.resolvedTitle')}
          </h2>
          <ul className="list-disc space-y-1 ps-6">
            {check.resolved.map((r) => (
              <li key={`${r.document}-${r.field}`}>{t('report.resolvedItem', { document: kb.catalogue.find((c) => c.kind === r.kind)?.label[locale] ?? '', field: t(`fields.${r.field}`), value: r.display })}</li>
            ))}
          </ul>
        </section>
      )}

      {analysis.documents.length < 2 ? (
        <p className="card">{t('report.empty')}</p>
      ) : (
        <>
          <p className="text-xl font-bold" data-testid="issue-count">
            {analysis.issueCount > 0 ? t('report.issues', { count: analysis.issueCount }) : t('report.noIssues')}
          </p>
          {analysis.fields.map((fa) => (
            <FieldSection key={fa.field} fa={fa} t={t} locale={locale} docLabel={docLabel} overrides={check.overrides} />
          ))}
          {analysis.notCompared.length > 0 && <p className="text-slate-500">{t('report.notCompared')}</p>}
          <Link href={`/${locale}/me/roadmap`} className="btn-primary">
            {t('report.toRoadmap')}
          </Link>
        </>
      )}
    </div>
  );
}

function FieldSection({
  fa,
  t,
  locale,
  docLabel,
  overrides,
}: {
  fa: FieldAnalysis;
  t: Translate;
  locale: string;
  docLabel: (id: string) => string;
  overrides: { id: string; document: string; field: string; decision: string; reason?: string }[];
}) {
  const options = choices(fa);
  const confirmed = fa.target?.status === 'confirmed';
  return (
    <section id={`target-${fa.field}`} className="card space-y-4" data-testid={`field-${fa.field}`} aria-labelledby={`h-${fa.field}`}>
      <h2 id={`h-${fa.field}`} className="text-xl font-bold">
        {t(`fields.${fa.field}`)}
      </h2>

      <div className="space-y-1 rounded-xl bg-mist-50 p-3" data-testid="target">
        <p className="field-label">{t('report.target')}</p>
        {fa.target ? (
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold">{fa.target.display}</span>
            <span className={`rounded-full px-2 py-0.5 text-[0.8125rem] font-bold ${confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {confirmed ? t('report.confirmedTarget') : t('report.suggestedTarget')}
            </span>
          </p>
        ) : (
          <p>{t('report.noTarget')}</p>
        )}
        {!confirmed && fa.suggestion && (
          <p className="text-[0.875rem] text-slate-500">
            {t(`report.suggestionReason.${fa.suggestion.reason}`)}
            {fa.suggestion.supportedBy.length > 0 && ` ${t('report.supportedBy', { documents: fa.suggestion.supportedBy.map(docLabel).join(', ') })}`}
          </p>
        )}
        {fa.suggestionDiffers && fa.suggestion && <p className="font-semibold text-amber-700">{t('report.suggestionDiffers', { value: fa.suggestion.display })}</p>}
      </div>

      {options.length > 0 && (
        <details open={!confirmed} className="rounded-xl border border-line-200 p-3">
          <summary className="cursor-pointer font-bold">{t('report.chooseTarget')}</summary>
          <p className="mt-2 text-[0.875rem]">{t('report.targetHint')}</p>
          <form action={confirmTargetAction} className="mt-3 space-y-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="field" value={fa.field} />
            <fieldset className="space-y-2">
              <legend className="sr-only">{t('report.chooseTarget')}</legend>
              {options.map((o, i) => (
                <label key={i} className="choice">
                  <input type="radio" name="choice" value={JSON.stringify(o.value)} defaultChecked={fa.target ? o.display === fa.target.display : i === 0} required />
                  <span>
                    <span className="block font-bold">{o.display}</span>
                    {o.documents.length > 0 && <span className="block text-[0.875rem] text-slate-500">{o.documents.map(docLabel).join(', ')}</span>}
                  </span>
                </label>
              ))}
              {fa.field !== 'address' && (
                <label className="choice flex-wrap">
                  <input type="radio" name="choice" value="other" />
                  <span className="font-bold">{t('report.otherValue')}</span>
                  <input name="other" className="field-input" aria-label={t('report.otherValue')} placeholder={t('report.otherHint')} />
                </label>
              )}
            </fieldset>
            <SubmitButton>{t('report.saveTarget')}</SubmitButton>
          </form>
        </details>
      )}

      <ul className="space-y-3">
        {fa.results.map((r) => {
          const override = overrides.find((o) => o.document === r.document && o.field === fa.field);
          return (
            <li key={r.document} className="space-y-2 border-t border-line-200 pt-3" data-testid="result" data-document={r.document}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{docLabel(r.document)}</span>
                <SeverityChip status={r.status} label={t(`report.status.${r.status}`)} />
              </div>
              <p className="text-lg">{r.value !== null ? displayValue(r.value) : <span className="text-slate-500">{t('report.notEntered')}</span>}</p>
              {r.reason && r.status !== 'exact_match' && <p className="text-[0.875rem] text-slate-500">{t(`report.reasons.${r.reason}`)}</p>}
              {override ? (
                <form action={revokeOverrideAction} className="flex flex-wrap items-center gap-2 text-[0.875rem]">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={override.id} />
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 font-bold text-sky-600">{t('report.overridden')}</span>
                  <span>{override.reason}</span>
                  <button type="submit" className="btn-quiet">
                    {t('report.removeDecision')}
                  </button>
                </form>
              ) : (
                r.status !== 'missing' &&
                r.status !== 'exact_match' && (
                  <details>
                    <summary className="cursor-pointer text-[0.875rem] font-semibold text-sky-600">{t('report.dispute')}</summary>
                    <form action={setOverrideAction} className="mt-2 space-y-3">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="field" value={fa.field} />
                      <input type="hidden" name="document" value={r.document} />
                      <label className="choice">
                        <input type="radio" name="decision" value="accepted_equivalent" defaultChecked />
                        <span>{t('report.decisionSame')}</span>
                      </label>
                      <label className="choice">
                        <input type="radio" name="decision" value="requires_correction" />
                        <span>{t('report.decisionCorrect')}</span>
                      </label>
                      <div>
                        <label className="field-label" htmlFor={`reason-${fa.field}-${r.document}`}>
                          {t('report.reason')}
                        </label>
                        <input id={`reason-${fa.field}-${r.document}`} name="reason" className="field-input" placeholder={t('report.reasonHint')} required maxLength={500} />
                      </div>
                      <SubmitButton variant="secondary">{t('report.saveDecision')}</SubmitButton>
                    </form>
                  </details>
                )
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
