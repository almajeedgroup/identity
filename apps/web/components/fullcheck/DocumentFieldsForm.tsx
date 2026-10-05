import { catalogueEntry, type DocumentKind, type KnowledgeBase } from '@identity/content';
import { displayValue, type AddressValue } from '@identity/engine';
import type { Locale } from '@/i18n/config';
import type { Translate } from '@/i18n/translate';

type Value = string | AddressValue | null | undefined;

export interface ReadField {
  original: string | AddressValue;
  confidence: number | null;
}

interface Props {
  t: Translate;
  locale: Locale;
  kb: KnowledgeBase;
  kind: DocumentKind;
  /** Values to show in the boxes. */
  values?: Record<string, Value>;
  /** M17-AC-3.3 · verification: what OCR read and how sure it was. */
  read?: Record<string, ReadField>;
  numberMode: 'new' | 'verify' | 'edit';
  numberMasked?: string | null;
}

const LOW_CONFIDENCE = 0.8;
const RELATIONS = ['father', 'mother', 'husband', 'wife', 'other'] as const;
const GENDERS = [
  ['Male', 'genderMale'],
  ['Female', 'genderFemale'],
  ['Transgender', 'genderTransgender'],
] as const;

const str = (v: Value) => (typeof v === 'string' ? v : '');
const addr = (v: Value) => (v && typeof v === 'object' ? v : {});

function ReadNote({ t, field }: { t: Translate; field: ReadField | undefined }) {
  if (!field) return <p className="mt-1 text-[0.875rem] text-slate-500">{t('verify.notRead')}</p>;
  const low = field.confidence !== null && field.confidence < LOW_CONFIDENCE;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.875rem] text-slate-500">
      <span>{t('verify.weRead', { value: displayValue(field.original) })}</span>
      {field.confidence !== null && (
        <span data-testid="confidence" className={`rounded-full px-2 py-0.5 font-bold ${low ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {t('verify.confidence', { percent: Math.round(field.confidence * 100) })}
          {low ? ` · ${t('verify.lowConfidence')}` : ''}
        </span>
      )}
    </p>
  );
}

/** M17-AC-1.1 · Exactly the fields this document prints (F02 catalogue), plus its number. */
export function DocumentFieldsForm({ t, locale, kb, kind, values = {}, read, numberMode, numberMasked }: Props) {
  const entry = catalogueEntry(kb, kind);
  const verify = !!read;
  const lowClass = (field: string) => (verify && read?.[field]?.confidence != null && read[field]!.confidence! < LOW_CONFIDENCE ? ' border-amber-400 bg-amber-50' : '');

  return (
    <div className="space-y-5">
      {entry.fields.map(({ field }) => {
        if (field === 'address') {
          const a = addr(values.address);
          return (
            <fieldset key={field} className={`space-y-3 rounded-xl border-2 border-line-200 p-4${lowClass('address')}`} data-field="address">
              <legend className="px-1 font-bold">{t('fields.address')}</legend>
              {verify && <ReadNote t={t} field={read?.address} />}
              {(
                [
                  ['line', 'addressLine'],
                  ['city', 'addressCity'],
                  ['district', 'addressDistrict'],
                  ['state', 'addressState'],
                  ['pin', 'addressPin'],
                ] as const
              ).map(([part, label]) => (
                <div key={part}>
                  <label className="field-label" htmlFor={`f-address-${part}`}>
                    {t(`fields.${label}`)}
                  </label>
                  <input
                    id={`f-address-${part}`}
                    name={`address_${part}`}
                    className="field-input"
                    defaultValue={a[part] ?? ''}
                    {...(part === 'pin' ? { inputMode: 'numeric' as const, maxLength: 6, pattern: '[0-9]{6}' } : {})}
                  />
                </div>
              ))}
            </fieldset>
          );
        }
        if (field === 'gender') {
          const current = str(values.gender);
          const known = GENDERS.some(([v]) => v === current);
          return (
            <div key={field} data-field="gender">
              <label className="field-label" htmlFor="f-gender">
                {t('fields.gender')}
              </label>
              <select id="f-gender" name="gender" className={`field-input${lowClass('gender')}`} defaultValue={current}>
                <option value="">{t('fields.choose')}</option>
                {!known && current && <option value={current}>{current}</option>}
                {GENDERS.map(([v, key]) => (
                  <option key={v} value={v}>
                    {t(`fields.${key}`)}
                  </option>
                ))}
              </select>
              {verify && <ReadNote t={t} field={read?.gender} />}
            </div>
          );
        }
        if (field === 'relative_name') {
          const relation = str(values.relative_type);
          return (
            <div key={field} className="space-y-3" data-field="relative_name">
              <div>
                <label className="field-label" htmlFor="f-relative_name">
                  {t('fields.relative_name')}
                </label>
                <input id="f-relative_name" name="relative_name" className={`field-input${lowClass('relative_name')}`} defaultValue={str(values.relative_name)} autoComplete="off" />
                {verify && <ReadNote t={t} field={read?.relative_name} />}
              </div>
              <div>
                <label className="field-label" htmlFor="f-relative_type">
                  {t('fields.relative_type')}
                </label>
                <select id="f-relative_type" name="relative_type" className="field-input" defaultValue={relation}>
                  <option value="">{t('fields.choose')}</option>
                  {RELATIONS.map((r) => (
                    <option key={r} value={r}>
                      {t(`fields.relation.${r}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        }
        return (
          <div key={field} data-field={field}>
            <label className="field-label" htmlFor={`f-${field}`}>
              {t(`fields.${field}`)}
            </label>
            <input
              id={`f-${field}`}
              name={field}
              className={`field-input${lowClass(field)}`}
              defaultValue={str(values[field])}
              autoComplete="off"
              {...(field === 'dob' ? { 'aria-describedby': 'f-dob-hint' } : {})}
            />
            {field === 'dob' && (
              <p id="f-dob-hint" className="mt-1 text-[0.875rem] text-slate-500">
                {t('fields.dobHint')}
              </p>
            )}
            {verify && <ReadNote t={t} field={read?.[field]} />}
          </div>
        );
      })}

      <div data-field="number">
        {entry.numberStorage === 'last4_only' ? (
          <>
            <label className="field-label" htmlFor="f-number">
              {t('fields.aadhaarLast4')}
            </label>
            <input id="f-number" name="number" className="field-input" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" autoComplete="off" aria-describedby="f-number-hint" />
            <p id="f-number-hint" className="mt-1 text-[0.875rem] font-semibold text-coral-700">
              {t('fields.aadhaarLast4Hint')}
            </p>
          </>
        ) : (
          <>
            <label className="field-label" htmlFor="f-number">
              {entry.numberLabel[locale]}
            </label>
            <input id="f-number" name="number" className="field-input" autoComplete="off" autoCapitalize="characters" aria-describedby="f-number-hint" />
            <p id="f-number-hint" className="mt-1 text-[0.875rem] text-slate-500">
              {t('fields.numberOptional')}
            </p>
          </>
        )}
        {numberMode !== 'new' && numberMasked && (
          <p className="mt-1 text-[0.875rem] text-slate-500" dir="auto">
            {t('verify.numberRead', { masked: numberMasked })}
          </p>
        )}
      </div>
    </div>
  );
}
