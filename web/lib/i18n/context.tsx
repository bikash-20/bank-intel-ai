'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { TRANSLATIONS, type Locale, type Translations } from './translations';

interface I18nContextType {
  locale: Locale;
  t: Translations;
  toggleLocale: () => void;
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  t: TRANSLATIONS.en,
  toggleLocale: () => {},
  setLocale: () => {},
});

const LOCALE_STORAGE_KEY = 'bank_intel_locale_v1';

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY) as Locale;
      if (saved === 'bn' || saved === 'en') {
        setLocaleState(saved);
      }
    } catch {
      // Ignore localStorage read errors in restricted contexts
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    } catch {
      // Ignore write errors
    }
  };

  const toggleLocale = () => {
    setLocale(locale === 'en' ? 'bn' : 'en');
  };

  const t = TRANSLATIONS[locale];

  return (
    <I18nContext.Provider value={{ locale, t, toggleLocale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n() {
  return useContext(I18nContext);
}

