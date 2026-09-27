// Intl.PluralRules (used by i18next for "1 entry" / "3 entries") is missing on some JS engines;
// this installs it only where it's missing or incomplete.
import 'intl-pluralrules';
import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ko from './ko.json';

/*
 * App text lives in one JSON file per language (en.json is the reference; every other file has the
 * same keys). To add a language: create xx.json and add it to RESOURCES below — nothing else changes.
 * English plurals use key_one / key_other; languages without plural forms (like Korean) only need _other.
 */
const RESOURCES = { en, ko } as const;

export type Language = keyof typeof RESOURCES;
/** What the user picked in Settings: follow the phone, or a fixed language. */
export type LanguagePref = 'system' | Language;

export const LANGUAGES = Object.keys(RESOURCES) as Language[];

/** Each language's name in that language ("English", "한국어"), shown the same whatever the app language is. */
export const languageName = (lang: Language) => RESOURCES[lang].languageName;

const isLanguage = (code: string | null | undefined): code is Language => !!code && code in RESOURCES;

/** The phone's language if the app has it, otherwise English. */
export function systemLanguage(): Language {
  try {
    const code = getLocales()[0]?.languageCode;
    return isLanguage(code) ? code : 'en';
  } catch {
    return 'en';
  }
}

/** The language to show for a Settings choice. Anything unknown (e.g. saved by a newer version) follows the phone. */
export const resolveLanguage = (pref: LanguagePref): Language => (isLanguage(pref) ? pref : systemLanguage());

// The app's own instance; initReactI18next makes it the one useTranslation() uses.
const i18n = createInstance();
i18n.use(initReactI18next).init({
  resources: Object.fromEntries(LANGUAGES.map((l) => [l, { translation: RESOURCES[l] }])),
  lng: systemLanguage(), // until settings load
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

/** Switches every screen to `lang` right away. Returns true if the language actually changed. */
export function applyLanguage(lang: Language): boolean {
  if (i18n.language === lang) return false;
  i18n.changeLanguage(lang);
  return true;
}

export const currentLanguage = () => i18n.language as Language;

/** For code outside React components (alerts, notifications, date formatting). Screens use useTranslation(). */
export const t = i18n.t.bind(i18n);

export default i18n;
