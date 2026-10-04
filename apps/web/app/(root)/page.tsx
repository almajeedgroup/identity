import { LanguageChooser } from '@/components/LanguageChooser';
import { locales } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { createTranslator } from '@/i18n/translate';

export default function ChooseLanguagePage() {
  // C-01 · "We are not a government office" on every page — here in all four languages.
  const notices = locales.map((locale) => {
    const t = createTranslator(locale, getMessages(locale));
    return { locale, text: `${t('brand.unit')}. ${t('trust.notGovernment')}` };
  });
  return <LanguageChooser notices={notices} />;
}
