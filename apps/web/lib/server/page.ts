import 'server-only';
import { isLocale, type Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { createTranslator, type Translate } from '@/i18n/translate';

export type LocaleParams = Promise<{ locale: string }>;
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function localeOf(params: LocaleParams): Promise<{ locale: Locale; t: Translate }> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  return { locale, t: createTranslator(locale, getMessages(locale)) };
}

export async function query(searchParams: SearchParams | undefined): Promise<Record<string, string>> {
  const raw = (await searchParams) ?? {};
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? (v[0] ?? '') : (v ?? '')]));
}

/** An error code from `?error=` as a message; unknown codes fall back to a generic one. */
export function errorMessage(t: Translate, code: string | undefined): string | null {
  if (!code) return null;
  try {
    return /^[a-z_]+$/.test(code) ? t(`errors.${code}`) : t('errors.generic');
  } catch {
    return t('errors.generic');
  }
}

/** DD-MM-YYYY, the same in every locale (F04-FR-05). */
export function formatDate(d: Date): string {
  const iso = d.toISOString().slice(0, 10);
  const [y, m, day] = iso.split('-');
  return `${day}-${m}-${y}`;
}

/** Keeps numbers and codes left-to-right inside any sentence, including Urdu (Unicode isolates). */
export const ltr = (text: string) => `\u2066${text}\u2069`;
