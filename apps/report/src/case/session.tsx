import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

// Memory only (crypto-design.md section 7). A reload starts over, on purpose.

interface Session {
  draft: string;
  setDraft: (draft: string) => void;
  code: Uint8Array | null;
  setCode: (code: Uint8Array | null) => void;
  reset: () => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState('');
  const [code, setCode] = useState<Uint8Array | null>(null);

  const value = useMemo<Session>(
    () => ({
      draft,
      setDraft,
      code,
      setCode,
      reset: () => {
        code?.fill(0);
        setDraft('');
        setCode(null);
      },
    }),
    [draft, code],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession needs a SessionProvider');
  }
  return context;
}
