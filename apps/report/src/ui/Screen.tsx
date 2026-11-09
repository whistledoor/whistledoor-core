import type { ReactNode } from 'react';
import { PageShell } from './PageShell';

interface ScreenProps {
  title?: string;
  /** Back link, step or status above the title. */
  meta?: ReactNode;
  children: ReactNode;
}

/** Returning to a case: header, one card, the provider line. */
export function Screen({ title, meta, children }: ScreenProps) {
  return (
    <PageShell>
      <div className="flex flex-col gap-4 rounded-[20px] border bg-card p-5 print:border-0 lg:p-8">
        {meta ? <div className="text-sm text-muted-foreground print:hidden">{meta}</div> : null}
        {title ? <h1 className="text-[26px] leading-tight font-semibold tracking-tight">{title}</h1> : null}
        {children}
      </div>
    </PageShell>
  );
}
