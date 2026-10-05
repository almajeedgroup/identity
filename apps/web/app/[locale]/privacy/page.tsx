import { NOTICE_VERSION } from '@identity/services';
import { localeOf, type LocaleParams } from '@/lib/server/page';

/** F06-AC-2.1 · The privacy notice in every language (draft for legal review, PRD §34). */
export default async function PrivacyPage({ params }: { params: LocaleParams }) {
  const { t } = await localeOf(params);
  const sections = ['quick', 'collect', 'why', 'who', 'security', 'rights', 'grievance'] as const;
  const retention = ['uploads', 'profile_and_documents', 'sign_in_codes'] as const;
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-[2rem] leading-tight font-extrabold">{t('privacy.title')}</h1>
        <p className="text-slate-500">{t('privacy.version', { version: NOTICE_VERSION })}</p>
      </header>
      <p className="text-lg">{t('privacy.intro')}</p>
      {sections.slice(0, 3).map((key) => (
        <section key={key} className="space-y-2">
          <h2 className="text-xl font-bold">{t(`privacy.${key}Title`)}</h2>
          <p>{t(`privacy.${key}Text`)}</p>
        </section>
      ))}
      <section className="space-y-2">
        <h2 className="text-xl font-bold">{t('privacy.retentionTitle')}</h2>
        <table className="w-full border-collapse overflow-hidden rounded-xl bg-white text-start" data-testid="retention">
          <tbody>
            {retention.map((key) => (
              <tr key={key} className="border-b border-line-200" data-retention={key}>
                <th scope="row" className="p-3 text-start align-top font-semibold">
                  {t(`privacy.retention.${key}`)}
                </th>
                <td className="p-3 align-top">{t(`privacy.kept.${key}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {sections.slice(3).map((key) => (
        <section key={key} className="space-y-2">
          <h2 className="text-xl font-bold">{t(`privacy.${key}Title`)}</h2>
          <p>{t(`privacy.${key}Text`)}</p>
        </section>
      ))}
    </article>
  );
}
