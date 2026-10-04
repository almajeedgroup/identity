import 'server-only';
import type { Locale } from './config';
import type { Messages } from './translate';
import en from '../messages/en.json';
import hi from '../messages/hi.json';
import kn from '../messages/kn.json';
import ur from '../messages/ur.json';

const all: Record<Locale, Messages> = { en, kn, hi, ur };

/** Server-only: the page passes just one locale's messages to the browser (F04 NFR). */
export function getMessages(locale: Locale): Messages {
  return all[locale];
}
