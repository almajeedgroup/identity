import { STATE_INFO, type CaseState } from '@identity/domain';
import { getMyCase } from '@identity/services';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Banner } from '@/components/fullcheck/Banner';
import { SubmitButton } from '@/components/fullcheck/SubmitButton';
import { citizenReplyAction, withdrawCaseAction } from '@/lib/server/actions';
import { requireFullCheck } from '@/lib/server/fullcheck';
import { errorMessage, formatDate, localeOf, ltr, query, type SearchParams } from '@/lib/server/page';

export const dynamic = 'force-dynamic';

/** M04-AC-2.1 … 2.3 · The case tracker. */
export default async function CasePage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: SearchParams }) {
  const { locale, t } = await localeOf(params);
  const { id } = await params;
  const q = await query(searchParams);
  const { s, userId } = await requireFullCheck(locale);
  const c = await getMyCase(s, userId, id);
  if (!c) notFound();
  const { kb } = await s.knowledge();
  const stage = (state: string) => t(`cases.stage.${STATE_INFO[state as CaseState].citizenStage}`);
  const open = !['completed', 'closed_not_proceeding', 'withdrawn'].includes(c.state);
  const error = errorMessage(t, q.error);
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[2rem] leading-tight font-extrabold">{t('cases.caseTitle', { id: ltr(c.caseId) })}</h1>
        <p className="text-lg">{kb.catalogue.find((d) => d.kind === c.documentKind)?.label[locale]}</p>
      </div>
      {q.created && <Banner tone="success">{t('cases.created', { id: ltr(c.caseId) })}</Banner>}
      {q.existing && <Banner tone="success">{t('cases.existing')}</Banner>}
      {q.replied && <Banner tone="success">{t('cases.replied')}</Banner>}
      {q.withdrawn && <Banner tone="success">{t('cases.withdrawnDone')}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      <section className="card space-y-2" data-testid="case-status">
        <p className="field-label">{t('cases.status')}</p>
        <p className="text-xl font-bold text-emerald-700" data-testid="stage">
          {stage(c.state)}
        </p>
        <p>{c.volunteer ? t('cases.volunteer', { name: c.volunteer }) : t('cases.noVolunteer')}</p>
        {c.appointmentAt && <p>{t('cases.appointment', { date: formatDate(c.appointmentAt) })}</p>}
        {c.applicationRef && (
          <p data-testid="reference">{t('cases.reference', { ref: ltr(c.applicationRef), date: c.applicationDate ? c.applicationDate.split('-').reverse().join('-') : '' })}</p>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="fix-title">
        <h2 id="fix-title" className="text-lg font-bold">
          {t('cases.whatTitle')}
        </h2>
        <ul className="space-y-1">
          {c.issues.map((i) => (
            <li key={i.field} className="font-semibold">
              {t('roadmap.fix', { field: t(`fields.${i.field}`), from: i.current || t('report.notEntered'), to: i.target })}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2" aria-labelledby="timeline-title">
        <h2 id="timeline-title" className="text-lg font-bold">
          {t('cases.timeline')}
        </h2>
        <ol className="space-y-2 border-s-2 border-emerald-600 ps-4" data-testid="timeline">
          {c.timeline.map((e, i) => (
            <li key={i}>
              <span className="font-semibold">
                {e.kind === 'state' && e.toState ? stage(e.toState) : t(`cases.event.${e.kind}`)}
              </span>{' '}
              <span className="text-[0.875rem] text-slate-500">{formatDate(e.at)}</span>
            </li>
          ))}
        </ol>
      </section>

      {c.notes.length > 0 && (
        <section className="space-y-2" aria-labelledby="notes-title">
          <h2 id="notes-title" className="text-lg font-bold">
            {t('cases.messages')}
          </h2>
          <ul className="space-y-2" data-testid="notes">
            {c.notes.map((n, i) => (
              <li key={i} className={`rounded-xl p-3 ${n.byCitizen ? 'bg-emerald-50' : 'bg-white'}`}>
                <p className="text-[0.875rem] font-semibold text-slate-500">
                  {n.byCitizen ? t('cases.you') : (n.author ?? '1dentity')} · {formatDate(n.at)}
                </p>
                <p className="whitespace-pre-line" dir="auto">
                  {n.body}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.files.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">{t('cases.files')}</h2>
          <ul className="space-y-1">
            {c.files.map((f) => (
              <li key={f.id}>
                {f.purged ? (
                  <span className="text-slate-500">{t('cases.filePurged')}</span>
                ) : (
                  <a href={`/api/case-files/${c.id}/${f.id}`} target="_blank" rel="noopener">
                    {f.label ?? t('cases.file')} · {formatDate(f.at)}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.state === 'awaiting_citizen' && (
        <form action={citizenReplyAction} className="card space-y-4" aria-labelledby="reply-title">
          <h2 id="reply-title" className="text-lg font-bold">
            {t('cases.replyTitle')}
          </h2>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={c.id} />
          <div>
            <label className="field-label" htmlFor="message">
              {t('cases.message')}
            </label>
            <textarea id="message" name="message" className="field-input min-h-24" maxLength={2000} />
          </div>
          <div>
            <label className="field-label" htmlFor="file">
              {t('cases.attach')}
            </label>
            <input id="file" name="file" type="file" accept="image/jpeg,image/png,application/pdf" className="field-input py-3" />
            <p className="mt-1 text-[0.875rem] font-semibold text-coral-700">{t('consent.uploads.aadhaar')}</p>
          </div>
          <SubmitButton>{t('cases.send')}</SubmitButton>
        </form>
      )}

      <p className="rounded-xl border-2 border-coral-500 bg-coral-50 p-4 font-bold text-coral-700">{t('trust.otpWarning')}</p>

      {open && (
        <details className="rounded-xl border-2 border-line-200 bg-white p-4">
          <summary className="cursor-pointer font-bold text-coral-700">{t('cases.withdraw')}</summary>
          <form action={withdrawCaseAction} className="mt-3 space-y-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={c.id} />
            <p>{t('cases.withdrawText')}</p>
            <label className="choice">
              <input type="checkbox" name="confirm" value="yes" required />
              <span>{t('settings.confirm')}</span>
            </label>
            <SubmitButton variant="danger">{t('cases.withdraw')}</SubmitButton>
          </form>
        </details>
      )}
      <Link href={`/${locale}/me/cases`} className="btn-quiet">
        {t('cases.title')}
      </Link>
    </div>
  );
}
