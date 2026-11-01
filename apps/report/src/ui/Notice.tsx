import type { ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function Notice({ children }: { children: ReactNode }) {
  return (
    <Alert className="border-transparent bg-notice text-notice-foreground">
      <AlertDescription className="text-notice-foreground">{children}</AlertDescription>
    </Alert>
  );
}
