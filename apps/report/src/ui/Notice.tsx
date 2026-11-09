import type { ReactNode } from 'react';
import { Callout } from './Callout';

/** A warning. `alert` announces it, for errors that appear after an action. */
export function Notice({ children, alert = false }: { children: ReactNode; alert?: boolean }) {
  return (
    <Callout tone="warn" alert={alert}>
      {children}
    </Callout>
  );
}
