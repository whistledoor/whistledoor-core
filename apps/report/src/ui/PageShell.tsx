import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '../i18n/i18n';
import { AppHeader } from './AppHeader';

/** Header, one column of content, and the provider line. */
export function PageShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className={cn('mx-auto flex w-full flex-1 flex-col gap-5 px-5 py-7 lg:py-12', wide ? 'max-w-[1120px] lg:px-12' : 'max-w-2xl')}>
        {children}
      </main>
      <footer className="px-5 pb-6 text-center text-xs text-muted-foreground print:hidden">{t.providedBy}</footer>
    </div>
  );
}
