import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

// Same key as public/theme.js, which applies it before the first paint.
const STORAGE_KEY = 'theme';
const DARK_SCHEME = '(prefers-color-scheme: dark)';

const listeners = new Set<() => void>();

function systemTheme(): Theme {
  return window.matchMedia(DARK_SCHEME).matches ? 'dark' : 'light';
}

/** The chosen theme, else the system's. */
export function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  return chosen === 'light' || chosen === 'dark' ? chosen : systemTheme();
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The choice then lasts for this visit only.
  }
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  const scheme = window.matchMedia(DARK_SCHEME);
  listeners.add(listener);
  scheme.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    scheme.removeEventListener('change', listener);
  };
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme);
}
