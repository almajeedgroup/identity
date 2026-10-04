'use client';

import { seedBundle } from '@identity/content';
import { evaluateHealthCheck } from '@identity/rules';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatIsoDate } from '@/i18n/format';
import { useI18n } from '@/i18n/I18nProvider';
import { loadSavedHealthCheck, type SavedHealthCheck } from '@/lib/storage';
import { ScoreDial } from './ScoreDial';

/** M01-AC-5.1 · Shows the last check saved on this device, if any. */
export function LastCheckSummary() {
  const { locale, t } = useI18n();
  const [saved, setSaved] = useState<SavedHealthCheck | null>(null);

  useEffect(() => {
    setSaved(loadSavedHealthCheck());
  }, []);

  if (!saved) return null;
  const report = evaluateHealthCheck(saved.input, seedBundle);
  return (
    <section className="card flex items-center gap-4" data-testid="last-check">
      <ScoreDial score={report.score} band={report.band} label={t('result.scoreLabel', { score: report.score })} />
      <div className="space-y-1">
        <h2 className="text-lg font-bold">{t('home.lastCheck')}</h2>
        <p>
          {t(`result.band.${report.band}`)}
          {report.issueCount > 0 && <> — {t('common.issues', { count: report.issueCount })}</>}
        </p>
        <p className="text-slate-500">{t('home.lastCheckOn', { date: formatIsoDate(saved.savedOn) })}</p>
        <Link href={`/${locale}/check?show=last`} className="font-semibold">
          {t('home.viewResult')}
        </Link>
      </div>
    </section>
  );
}
