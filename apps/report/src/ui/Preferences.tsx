import type { Language } from '@whistledoor/api-contract';
import { useI18n } from '../i18n/i18n';
import { ThemeToggle } from '../theme/ThemeToggle';

const LANGUAGES: readonly Language[] = ['de', 'en'];

/** Both languages as buttons, so each stays one tap away, and the theme switch. */
export function Preferences() {
  const { t, language, setLanguage } = useI18n();
  return (
    <div className="flex items-center">
      <fieldset className="flex">
        <legend className="sr-only">{t.languageLabel}</legend>
        {LANGUAGES.map((option) => (
          <button
            key={option}
            type="button"
            lang={option}
            aria-pressed={language === option}
            className="inline-flex size-11 cursor-pointer items-center justify-center rounded-[10px] text-[13px] font-medium text-muted-foreground uppercase hover:bg-accent aria-pressed:font-bold aria-pressed:text-foreground"
            onClick={() => setLanguage(option)}
          >
            {option}
          </button>
        ))}
      </fieldset>
      <ThemeToggle />
    </div>
  );
}
