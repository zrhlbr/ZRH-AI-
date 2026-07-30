import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './locales/zh-CN.json';
import myMM from './locales/my-MM.json';
import enUS from './locales/en-US.json';

export const SUPPORTED_LANGUAGES = ['zh-CN', 'my-MM', 'en-US'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'my-MM': { translation: myMM },
      'en-US': { translation: enUS },
    },
    fallbackLng: 'zh-CN',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    detection: {
      // localStorage 持久化：刷新后语言选择保持
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'zrh-ai-language',
    },
    interpolation: {
      escapeValue: false,
    },
  });

// 同步 <html lang>，供缅文字体等 CSS 规则使用
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18n.language || 'zh-CN';

export default i18n;
