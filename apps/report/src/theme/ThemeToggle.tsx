import { MoonIcon, SunIcon } from 'lucide-react';
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
      className="inline-flex size-11 cursor-pointer items-center justify-center rounded-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {/* The icon shows what a press switches to. */}
      {dark ? <SunIcon aria-hidden="true" className="size-5" /> : <MoonIcon aria-hidden="true" className="size-5" />}
    </button>
  );
}
