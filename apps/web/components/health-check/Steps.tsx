'use client';

import type { DocKind, DocumentType } from '@identity/content';
import type { Answer } from '@identity/rules';
import { useId } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import type { DocForm, SituationForm } from './form';

export function StartStep({
  documents,
  held,
  onToggle,
  ownPhone,
  onOwnPhone,
  error,
}: {
  documents: DocumentType[];
  held: DocKind[];
  onToggle: (kind: DocKind) => void;
  ownPhone: 'yes' | 'no';
  onOwnPhone: (value: 'yes' | 'no') => void;
  error: boolean;
}) {
  const { locale, t } = useI18n();
  const errorId = useId();
  return (
    <div className="space-y-6">
      <p className="rounded-xl bg-emerald-50 p-4 text-emerald-700">{t('check.start.privacy')}</p>

      <fieldset className="space-y-2" aria-describedby={error ? errorId : undefined}>
        <legend className="mb-1 text-lg font-bold">{t('check.start.documents')}</legend>
        <p className="text-slate-500">{t('check.start.documentsHint')}</p>
        {documents.map((d) => (
          <label key={d.kind} className="choice">
            <input type="checkbox" name="documents" checked={held.includes(d.kind)} onChange={() => onToggle(d.kind)} />
            <span className="font-semibold">{d.label[locale]}</span>
          </label>
        ))}
        {error && (
          <p id={errorId} role="alert" className="font-semibold text-coral-700">
            {t('check.start.noDocuments')}
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-lg font-bold">{t('check.start.ownPhone')}</legend>
        {(['no', 'yes'] as const).map((v) => (
          <label key={v} className="choice">
            <input type="radio" name="ownPhone" value={v} checked={ownPhone === v} onChange={() => onOwnPhone(v)} />
            <span>{v === 'yes' ? t('check.start.ownPhoneYes') : t('check.start.ownPhoneNo')}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

export function DocumentStep({
  document,
  form,
  onChange,
  dobError,
}: {
  document: DocumentType;
  form: DocForm;
  onChange: (patch: Partial<DocForm>) => void;
  dobError: boolean;
}) {
  const { locale, t } = useI18n();
  const id = useId();
  const label = document.label[locale];
  const prints = (f: 'gender' | 'address') => document.fieldsPrinted.includes(f);
  return (
    <div className="space-y-5">
      <p className="text-slate-500">{t('check.doc.hint')}</p>

      <div>
        <label htmlFor={`${id}-name`} className="field-label">
          {t('check.doc.name', { document: label })}
        </label>
        <input
          id={`${id}-name`}
          className="field-input"
          dir="ltr"
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <fieldset aria-describedby={dobError ? `${id}-dob-error` : undefined}>
        <legend className="field-label">{t('check.doc.dob')}</legend>
        <div className="grid grid-cols-3 gap-2" dir="ltr">
          {!form.yearOnly && (
            <>
              <NumberField id={`${id}-day`} label={t('check.doc.day')} value={form.day} max={2} onChange={(day) => onChange({ day })} invalid={dobError} />
              <NumberField id={`${id}-month`} label={t('check.doc.month')} value={form.month} max={2} onChange={(month) => onChange({ month })} invalid={dobError} />
            </>
          )}
          <NumberField id={`${id}-year`} label={t('check.doc.year')} value={form.year} max={4} onChange={(year) => onChange({ year })} invalid={dobError} />
        </div>
        <label className="choice mt-2">
          <input type="checkbox" checked={form.yearOnly} onChange={(e) => onChange({ yearOnly: e.target.checked })} />
          <span>{t('check.doc.yearOnly')}</span>
        </label>
        {dobError && (
          <p id={`${id}-dob-error`} role="alert" className="mt-2 font-semibold text-coral-700">
            {t('check.doc.invalidDate')}
          </p>
        )}
      </fieldset>

      {prints('gender') && (
        <fieldset className="space-y-2">
          <legend className="field-label">{t('check.doc.gender')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['male', 'check.doc.genderMale'],
                ['female', 'check.doc.genderFemale'],
                ['transgender', 'check.doc.genderTransgender'],
                ['unknown', 'check.doc.genderUnknown'],
              ] as const
            ).map(([value, key]) => (
              <label key={value} className="choice">
                <input type="radio" name={`${id}-gender`} checked={form.gender === value} onChange={() => onChange({ gender: value })} />
                <span>{t(key)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {prints('address') && (
        <div>
          <label htmlFor={`${id}-locality`} className="field-label">
            {t('check.doc.locality')}
          </label>
          <input
            id={`${id}-locality`}
            className="field-input"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${id}-locality-hint`}
            value={form.locality}
            onChange={(e) => onChange({ locality: e.target.value })}
          />
          <p id={`${id}-locality-hint`} className="mt-1 text-[0.8125rem] text-slate-500">
            {t('check.doc.localityHint')}
          </p>
        </div>
      )}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  max,
  onChange,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  max: number;
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[0.8125rem] font-semibold text-slate-500">
        {label}
      </label>
      <input
        id={id}
        className="field-input text-center"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={max}
        autoComplete="off"
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      />
    </div>
  );
}

export function SituationStep({
  hasAadhaar,
  hasAddressDocument,
  value,
  onChange,
}: {
  hasAadhaar: boolean;
  hasAddressDocument: boolean;
  value: SituationForm;
  onChange: (patch: Partial<SituationForm>) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      {hasAddressDocument && (
        <Question name="livesAtDocumentAddress" legend={t('check.situation.livesAtAddress')} value={value.livesAtDocumentAddress} onChange={(v) => onChange({ livesAtDocumentAddress: v })} />
      )}
      {hasAadhaar && (
        <>
          <Question
            name="mobileLinked"
            legend={t('check.situation.mobileLinked')}
            hint={t('check.situation.mobileLinkedHint')}
            value={value.mobileLinked}
            onChange={(v) => onChange({ mobileLinked: v })}
          />
          <Question
            name="documentsUpdatedWithin10Years"
            legend={t('check.situation.documentsUpdated')}
            value={value.documentsUpdatedWithin10Years}
            onChange={(v) => onChange({ documentsUpdatedWithin10Years: v })}
          />
        </>
      )}
    </div>
  );
}

function Question({
  name,
  legend,
  hint,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  hint?: string;
  value: Answer | '';
  onChange: (value: Answer) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <fieldset className="space-y-2" aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className="mb-1 text-lg font-bold">{legend}</legend>
      {hint && (
        <p id={`${id}-hint`} className="text-slate-500">
          {hint}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        {(['yes', 'no', 'unsure'] as const).map((a) => (
          <label key={a} className="choice">
            <input type="radio" name={`${id}-${name}`} checked={value === a} onChange={() => onChange(a)} />
            <span>{t(`check.situation.${a}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
