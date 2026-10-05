import 'server-only';
import type { Db } from '@identity/db';
import { activeConsents, listProfiles, requireProfile, ServiceError, type Profile } from '@identity/services';
import { redirect } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { platform } from './platform';
import { chosenPerson, requireCitizen } from './session';

/** The signed-in citizen, the platform and their active consents. */
export async function citizenContext(locale: Locale) {
  const citizen = await requireCitizen(locale);
  const p = await platform();
  const consents = await activeConsents(p.db, citizen.user.id);
  return { citizen, userId: citizen.user.id, p, s: p.services, consents };
}

/**
 * M07-FR-02 · The profile being worked on: `requested` (a form field) or the chosen person, if it is one of the
 * holder's; otherwise the holder's own.
 */
export async function personProfile(db: Db, userId: string, requested?: string | null): Promise<Profile> {
  const id = requested || (await chosenPerson());
  try {
    return await requireProfile(db, userId, id);
  } catch (error) {
    if (error instanceof ServiceError && error.code === 'not_found') return requireProfile(db, userId);
    throw error;
  }
}

/** F06-FR-02 · Full Check pages need the Full Check consent; otherwise the notice on /me. */
export async function requireFullCheck(locale: Locale) {
  const ctx = await citizenContext(locale);
  if (!ctx.consents.has('full_check')) redirect(`/${locale}/me`);
  const [person, profiles] = await Promise.all([personProfile(ctx.p.db, ctx.userId), listProfiles(ctx.p.db, ctx.userId)]);
  return { ...ctx, person, profileId: person.id, hasFamily: profiles.length > 1 };
}
