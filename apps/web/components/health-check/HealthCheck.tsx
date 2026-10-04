'use client';

import { seedBundle, todayInIndia, type DocKind } from '@identity/content';
import { REFERENCE_ORDER, evaluateHealthCheck, type HealthCheckInput } from '@identity/rules';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { clearHealthCheck, loadSavedHealthCheck, saveHealthCheck } from '@/lib/storage';
import { emptyDocForm, readDob, toHealthCheckInput, type DocForm, type SituationForm } from './form';
import { Result, type SaveState } from './Result';
import { DocumentStep, SituationStep, StartStep } from './Steps';

type Step = 'start' | DocKind | 'situation';

const initialForms = (): Record<DocKind, DocForm> => ({ aadhaar: emptyDocForm(), pan: emptyDocForm(), voter_id: emptyDocForm() });
const initialSituation = (): SituationForm => ({ livesAtDocumentAddress: '', mobileLinked: '', documentsUpdatedWithin10Years: '' });

/** M01 · Document Health Check. Runs entirely in the browser; nothing is sent anywhere (C-04). */
export function HealthCheck() {
  const { locale, t } = useI18n();
  const bundle = seedBundle;

  const [stepIndex, setStepIndex] = useState(0);
  const [held, setHeld] = useState<DocKind[]>([]);
  const [ownPhone, setOwnPhone] = useState<'yes' | 'no'>('no'); // privacy by default: nothing saved unless chosen
  const [forms, setForms] = useState(initialForms);
  const [situation, setSituation] = useState(initialSituation);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<{ input: HealthCheckInput; saveState: SaveState } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const steps: Step[] = useMemo(() => ['start', ...REFERENCE_ORDER.filter((k) => held.includes(k)), 'situation'], [held]);
  const step = steps[Math.min(stepIndex, steps.length - 1)]!;

  // Open a saved result from the home screen (M01-AC-5.1).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('show') === 'last') {
      const saved = loadSavedHealthCheck();
      if (saved) setResult({ input: saved.input, saveState: 'saved' });
    }
  }, []);

  // Move focus to the new heading on every step change so screen readers announce it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [stepIndex, result]);

  const report = useMemo(() => (result ? evaluateHealthCheck(result.input, bundle) : null), [result, bundle]);
  const asOf = todayInIndia();

  const next = () => {
    if (step === 'start' && held.length === 0) return setError(true);
    if (step !== 'start' && step !== 'situation' && !readDob(forms[step]).ok) return setError(true);
    setError(false);
    if (step === 'situation') {
      const input = toHealthCheckInput(steps.filter((s): s is DocKind => s !== 'start' && s !== 'situation'), forms, situation);
      if (ownPhone === 'yes') saveHealthCheck(input, asOf);
      setResult({ input, saveState: ownPhone === 'yes' ? 'saved' : 'not_saved' });
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const back = () => {
    setError(false);
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const restart = () => {
    setResult(null);
    setStepIndex(0);
    setHeld([]);
    setForms(initialForms());
    setSituation(initialSituation());
    setOwnPhone('no');
    setError(false);
    window.history.replaceState(null, '', window.location.pathname);
  };

  if (result && report) {
    return (
      <div className="space-y-6">
        <h1 ref={headingRef} tabIndex={-1} className="text-[2rem] leading-tight font-extrabold">
          {t('result.heading')}
        </h1>
        <Result
          report={report}
          input={result.input}
          bundle={bundle}
          asOf={asOf}
          saveState={result.saveState}
          onClear={() => {
            clearHealthCheck();
            setResult({ ...result, saveState: 'cleared' });
          }}
          onAgain={restart}
        />
      </div>
    );
  }

  const documentType = step !== 'start' && step !== 'situation' ? bundle.documents.find((d) => d.kind === step)! : null;
  const heading =
    step === 'start'
      ? t('check.start.heading')
      : step === 'situation'
        ? t('check.situation.heading')
        : t('check.doc.heading', { document: documentType!.label[locale] });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        next();
      }}
      className="space-y-6"
    >
      <div className="space-y-1">
        <p className="text-[0.8125rem] font-semibold tracking-wide text-slate-500 uppercase">{t('check.title')}</p>
        <p className="text-slate-500" data-testid="progress">
          {t('check.step', { current: stepIndex + 1, total: steps.length })}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="text-[2rem] leading-tight font-extrabold">
          {heading}
        </h1>
      </div>

      {step === 'start' && (
        <StartStep
          documents={bundle.documents}
          held={held}
          onToggle={(kind) => {
            setError(false);
            setHeld((h) => (h.includes(kind) ? h.filter((k) => k !== kind) : [...h, kind]));
          }}
          ownPhone={ownPhone}
          onOwnPhone={setOwnPhone}
          error={error}
        />
      )}
      {documentType && (
        <DocumentStep
          key={documentType.kind}
          document={documentType}
          form={forms[documentType.kind]}
          onChange={(patch) => {
            setError(false);
            setForms((f) => ({ ...f, [documentType.kind]: { ...f[documentType.kind], ...patch } }));
          }}
          dobError={error}
        />
      )}
      {step === 'situation' && (
        <SituationStep
          hasAadhaar={held.includes('aadhaar')}
          hasAddressDocument={held.some((k) => bundle.documents.find((d) => d.kind === k)?.fieldsPrinted.includes('address'))}
          value={situation}
          onChange={(patch) => setSituation((s) => ({ ...s, ...patch }))}
        />
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-line-200 pt-5 sm:flex-row sm:justify-between">
        {stepIndex > 0 ? (
          <button type="button" className="btn-secondary" onClick={back}>
            {t('check.back')}
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="btn-primary">
          {step === 'situation' ? t('check.seeResult') : t('check.next')}
        </button>
      </div>
    </form>
  );
}
