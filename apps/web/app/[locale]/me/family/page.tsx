import { listFamily, MAX_FAMILY, PARENT_ROLES, relationshipNotes, RELATIONSHIPS, type RelationshipNote } from '@identity/services';
import Link from 'next/link';
import { Banner } from '@/components/fullcheck/Banner';
import { SubmitButton } from '@/components/fullcheck/SubmitButton';
import { addFamilyMemberAction, choosePersonAction, removeFamilyMemberAction } from '@/lib/server/actions';
import { requireFullCheck } from '@/lib/server/fullcheck';
import { errorMessage, localeOf, query, type LocaleParams, type SearchParams } from '@/lib/server/page';

export const dynamic = 'force-dynamic';

/** M07 · Family members: add, choose whose documents to look at, relationship names (information only), remove. */
export default async function FamilyPage({ params, searchParams }: { params: LocaleParams; searchParams: SearchParams }) {
  const { locale, t } = await localeOf(params);
  const q = await query(searchParams);
  const { s, userId, person } = await requireFullCheck(locale);
  const [family, { kb }] = await Promise.all([listFamily(s, userId), s.knowledge()]);
  const notes = new Map<string, RelationshipNote[]>();
  for (const m of family) notes.set(m.id, await relationshipNotes(s, userId, m.id));
  const docLabel = (kind: string) => kb.catalogue.find((c) => c.kind === kind)?.label[locale] ?? kind;
  const error = errorMessage(t, q.error);
  const viewingSelf = person.relationship === 'self';

  return (
    <div className="space-y-6">
      <h1 className="text-[2rem] leading-tight font-extrabold">{t('family.title')}</h1>
      <p>{t('family.intro')}</p>
      {q.removed && <Banner tone="success">{t('family.removed')}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      <section className="card space-y-3" aria-labelledby="you-title">
        <h2 id="you-title" className="text-lg font-bold">
          {t('family.you')}
        </h2>
        {viewingSelf ? (
          <p className="font-semibold text-emerald-700">{t('family.showing')}</p>
        ) : (
          <form action={choosePersonAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="person" value="" />
            <SubmitButton variant="secondary">{t('family.showMine')}</SubmitButton>
          </form>
        )}
      </section>

      {family.length === 0 ? (
        <p className="card">{t('family.empty')}</p>
      ) : (
        <ul className="space-y-3" data-testid="family">
          {family.map((m) => {
            const memberNotes = notes.get(m.id) ?? [];
            return (
              <li key={m.id} className="card space-y-3" data-testid="family-member">
                <h2 className="text-lg font-bold">
                  {m.name} <span className="font-normal text-slate-500">({t(`family.rel.${m.relationship}`)})</span>
                </h2>
                <p className="text-slate-500">{t('family.documents', { count: m.documents })}</p>
                {person.id === m.id ? (
                  <p className="font-semibold text-emerald-700">{t('family.showing')}</p>
                ) : (
                  <form action={choosePersonAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="person" value={m.id} />
                    <SubmitButton variant="secondary">{t('family.show')}</SubmitButton>
                  </form>
                )}
                {memberNotes.length > 0 && (
                  <div className="space-y-2 rounded-xl bg-sky-50 p-3" data-testid="relationship-notes">
                    <h3 className="font-bold">{t('family.notesTitle')}</h3>
                    <p>{t('family.notesIntro')}</p>
                    <ul className="list-disc space-y-1 ps-6">
                      {memberNotes.map((n) => (
                        <li key={`${n.document}-${n.field}`}>
                          {t('family.noteLine', {
                            document: docLabel(n.kind),
                            whose: n.on === 'self' ? t('family.you') : m.name,
                            field: t(`fields.${n.field}`),
                            printed: n.printed,
                            expected: n.expected,
                          })}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <details className="rounded-xl border-2 border-line-200 p-3">
                  <summary className="cursor-pointer font-bold text-coral-700">{t('family.remove')}</summary>
                  <form action={removeFamilyMemberAction} className="mt-3 space-y-3">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="person" value={m.id} />
                    <label className="choice">
                      <input type="checkbox" name="confirm" value="yes" required />
                      <span>{t('family.removeConfirm')}</span>
                    </label>
                    <SubmitButton variant="danger">{t('family.remove')}</SubmitButton>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      {family.length < MAX_FAMILY && (
        <form action={addFamilyMemberAction} className="card space-y-5" aria-labelledby="add-title">
          <input type="hidden" name="locale" value={locale} />
          <h2 id="add-title" className="text-xl font-bold">
            {t('family.add')}
          </h2>
          <p className="text-slate-500">{t('family.limit', { count: MAX_FAMILY })}</p>
          <div>
            <label className="field-label" htmlFor="name">
              {t('family.name')}
            </label>
            <input id="name" name="name" className="field-input" required maxLength={120} autoComplete="off" />
          </div>
          <fieldset className="space-y-2">
            <legend className="field-label">{t('family.relationship')}</legend>
            {RELATIONSHIPS.map((r) => (
              <label key={r} className="choice">
                <input type="radio" name="relationship" value={r} required />
                <span>{t(`family.relLabel.${r}`)}</span>
              </label>
            ))}
          </fieldset>
          <div>
            <label className="field-label" htmlFor="parent_role">
              {t('family.parentRole')}
            </label>
            <select id="parent_role" name="parent_role" className="field-input" defaultValue="">
              <option value="">{t('fields.choose')}</option>
              {PARENT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`family.roleLabel.${r}`)}
                </option>
              ))}
            </select>
          </div>
          <label className="choice">
            <input type="checkbox" name="declared" value="yes" required />
            <span>{t('family.declare')}</span>
          </label>
          <SubmitButton>{t('family.add')}</SubmitButton>
        </form>
      )}

      <Link href={`/${locale}/me`} className="btn-quiet">
        {t('me.title')}
      </Link>
    </div>
  );
}
