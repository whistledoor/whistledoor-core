import { useI18n } from '../i18n/i18n';
import { setTheme, useTheme } from './theme';

export function ThemeToggle() {
  const { t } = useI18n();
  const dark = useTheme() === 'dark';

  return (
    <button
      type="button"
      aria-label={t.darkMode}
      aria-pressed={dark}
      className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {/* The icon shows what a press switches to. */}
      <svg
        aria-hidden="true"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </svg>
    </button>
  );
}
