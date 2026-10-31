import type { LocalizedText } from '@fant/content-schema';

import { en } from './en';
import { ja, type Strings } from './ja';

export type Language = 'ja' | 'en';

/** Japanese on Japanese devices, English everywhere else (SET-05). */
export function languageFor(locale: string): Language {
  return locale.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

function deviceLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return 'ja';
  }
}

/** The app's language, fixed at launch from the device's. */
export const LANGUAGE: Language = languageFor(deviceLocale());

export const strings: Strings = LANGUAGE === 'ja' ? ja : en;

/** Text of a content item in the app's language; Japanese when it has no English. */
export function localized(text: LocalizedText): string {
  return (LANGUAGE === 'en' ? text.en : undefined) ?? text.ja;
}
