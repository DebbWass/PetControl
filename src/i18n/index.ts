import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import he from './locales/he.json';
import en from './locales/en.json';

const LANGUAGE_KEY = '@petcontrol:language';

export async function getStoredLanguage(): Promise<string> {
  try {
    const lang = await AsyncStorage.getItem(LANGUAGE_KEY);
    return lang ?? 'he';
  } catch {
    return 'he';
  }
}

export async function setLanguage(lang: string) {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  const isRTL = lang === 'he';
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.forceRTL(isRTL);
  }
  await i18n.changeLanguage(lang);
}

export async function initI18n() {
  const lang = await getStoredLanguage();
  I18nManager.forceRTL(lang === 'he');

  await i18n.use(initReactI18next).init({
    resources: {
      he: { translation: he },
      en: { translation: en },
    },
    lng: lang,
    fallbackLng: 'he',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });
}

export default i18n;
