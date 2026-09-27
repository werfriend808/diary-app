import 'i18next';
import en from './en.json';

// Makes t('some.key') type-checked against en.json, so a typo in a key is a compile error.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
