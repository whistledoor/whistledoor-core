import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Language } from '@whistledoor/api-contract';
import { de } from './de';
import { en } from './en';

const STORAGE_KEY = 'language';
const messages = { de, en };

interface I18n {
  t: typeof de;
  language: Language;
  setLanguage: (language: Language) => void;
}

const I18nContext = createContext<I18n | null>(null);

function isLanguage(value: string | null): value is Language {
  return value === 'de' || value === 'en';
}

// Storage can be blocked, for example in a private window or an iframe.
function readStored(): Language | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

function store(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // The choice then lasts for this visit only.
  }
}

function browserLanguage(): Language {
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function I18nProvider({ tenantDefault, children }: { tenantDefault?: Language | undefined; children: ReactNode }) {
  const [chosen, setChosen] = useState(readStored);
  const language = chosen ?? tenantDefault ?? browserLanguage();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18n>(
    () => ({
      t: messages[language],
      language,
      setLanguage: (next) => {
        store(next);
        setChosen(next);
      },
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n needs an I18nProvider');
  }
  return context;
}
