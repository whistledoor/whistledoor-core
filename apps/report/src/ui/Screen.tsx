import type { ReactNode } from 'react';

interface ScreenProps {
  title?: string;
  /** Back link, step or status above the title. */
  meta?: ReactNode;
  children: ReactNode;
}

export function Screen({ title, meta, children }: ScreenProps) {
  return (
    <div className="flex flex-col gap-4">
      {meta ? <div className="text-sm text-muted-foreground print:hidden">{meta}</div> : null}
      {title ? <h1 className="text-xl font-semibold tracking-tight">{title}</h1> : null}
      {children}
    </div>
  );
}
