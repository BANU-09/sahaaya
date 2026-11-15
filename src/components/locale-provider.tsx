'use client';
import { createContext, useContext, useSyncExternalStore, useEffect } from 'react';
import { LOCALES, normalizeLocale, getText, type Locale } from '@/lib/i18n';
const LocaleContext = createContext<{
  locale: Locale;
  t: (key: string) => string;
  setLocale: (value: Locale) => void;
}>({ locale: 'en', t: (key) => getText('en', key), setLocale: () => {} });
const subscribe = (callback: () => void) => {
  window.addEventListener('sahaaya-language', callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener('sahaaya-language', callback);
    window.removeEventListener('storage', callback);
  };
};
const snapshot = () => normalizeLocale(window.localStorage.getItem('sahaaya-language'));
const serverSnapshot = (): Locale => 'en';
const setLocale = (value: Locale) => {
  window.localStorage.setItem('sahaaya-language', value);
  window.dispatchEvent(new Event('sahaaya-language'));
};
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <LocaleContext.Provider value={{ locale, t: (key) => getText(locale, key), setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}
export const useLocale = () => useContext(LocaleContext);
export function LanguageSelect({ onChange }: { onChange?: (locale: Locale) => void }) {
  const { locale, t, setLocale } = useLocale();
  return (
    <label className="language-select">
      <span className="sr-only">{t('language')}</span>
      <span aria-hidden="true">文</span>
      <select
        aria-label={t('language')}
        value={locale}
        onChange={(event) => {
          const next = normalizeLocale(event.target.value);
          setLocale(next);
          onChange?.(next);
        }}
      >
        {Object.entries(LOCALES).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
