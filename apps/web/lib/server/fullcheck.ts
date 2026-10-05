import 'server-only';
import { activeConsents } from '@identity/services';
import { redirect } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { platform } from './platform';
import { requireCitizen } from './session';

/** The signed-in citizen, the platform and their active consents. */
export async function citizenContext(locale: Locale) {
  const citizen = await requireCitizen(locale);
  const p = await platform();
  const consents = await activeConsents(p.db, citizen.user.id);
  return { citizen, userId: citizen.user.id, p, s: p.services, consents };
}

/** F06-FR-02 · Full Check pages need the Full Check consent; otherwise the notice on /me. */
export async function requireFullCheck(locale: Locale) {
  const ctx = await citizenContext(locale);
  if (!ctx.consents.has('full_check')) redirect(`/${locale}/me`);
  return ctx;
}
