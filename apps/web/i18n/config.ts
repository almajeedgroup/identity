/** F04 · Locales, names in their own scripts, and direction. */
export const locales = ['en', 'kn', 'hi', 'ur'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/** Each language named in its own script (F04-AC-1.1). */
export const localeNames: Record<Locale, string> = {
  en: 'English',
  kn: 'ಕನ್ನಡ',
  hi: 'हिन्दी',
  ur: 'اردو',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

export function directionOf(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ur' ? 'rtl' : 'ltr';
}

/** Browser-storage key for the chosen language (F04-FR-02). */
export const LOCALE_STORAGE_KEY = 'identity.locale';
