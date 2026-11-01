import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { EMPTY_DRAFT } from './case';
import type { ReportDraft } from './case';

// Memory only (crypto-design.md section 7). A reload starts over, on purpose.

interface Session {
  draft: ReportDraft;
  updateDraft: (patch: Partial<ReportDraft>) => void;
  clearDraft: () => void;
  code: Uint8Array | null;
  setCode: (code: Uint8Array | null) => void;
  reset: () => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [code, setCode] = useState<Uint8Array | null>(null);

  const value = useMemo<Session>(
    () => ({
      draft,
      updateDraft: (patch) => setDraft((current) => ({ ...current, ...patch })),
      clearDraft: () => setDraft(EMPTY_DRAFT),
      code,
      setCode,
      reset: () => {
        code?.fill(0);
        setDraft(EMPTY_DRAFT);
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
