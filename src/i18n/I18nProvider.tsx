import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { translations, type Locale, type TranslationKey, type TranslationValue } from "./translations";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const languageStorageKey = "personal-manuscript-archive:locale";

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveTranslation(
  value: TranslationValue | undefined,
  vars: Record<string, string | number>,
): string {
  if (typeof value === "function") {
    return value(vars);
  }
  return value ?? "";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = window.localStorage.getItem(languageStorageKey);
    if (stored === "zh-TW" || stored === "en" || stored === "de") {
      return stored;
    }
    return "zh-TW";
  });

  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      setLocale(nextLocale) {
        window.localStorage.setItem(languageStorageKey, nextLocale);
        setLocaleState(nextLocale);
      },
      t(key, vars = {}) {
        const localized = translations[locale][key];
        if (localized) {
          return resolveTranslation(localized, vars);
        }
        return resolveTranslation(translations.en[key], vars);
      },
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
