import { Outlet } from '@tanstack/react-router';
import { Card, CardContent } from '@/components/ui/card';
import { useTenant } from '../api/useTenant';
import { useI18n } from '../i18n/i18n';
import { TenantLogo } from '../ui/TenantLogo';
import type { Language } from '@whistledoor/api-contract';

const LANGUAGES: readonly Language[] = ['de', 'en'];

export function Layout() {
  const { t, language, setLanguage } = useI18n();
  const { data: tenant } = useTenant();

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 p-4 sm:py-8">
      <header className="flex items-center justify-between gap-4 text-sm print:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <TenantLogo url={tenant?.branding?.logoUrl} />
          <div className="min-w-0">
            <p className="font-medium">{tenant?.name}</p>
            <p className="text-muted-foreground">{t.channel}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {LANGUAGES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={language === option}
              className="cursor-pointer text-muted-foreground uppercase aria-pressed:font-semibold aria-pressed:text-foreground"
              onClick={() => setLanguage(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </header>
      <main className="flex-1">
        <Card className="print:border-0 print:shadow-none">
          <CardContent>
            <Outlet />
          </CardContent>
        </Card>
      </main>
      <footer className="text-center text-xs text-muted-foreground print:hidden">{t.providedBy}</footer>
    </div>
  );
}
