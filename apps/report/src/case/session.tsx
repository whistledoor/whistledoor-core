import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { DraftAttachment } from './attachments';
import { EMPTY_DRAFT } from './case';
import type { ReportDraft } from './case';

// Memory only (crypto-design.md section 7). A reload starts over, on purpose.

interface Session {
  draft: ReportDraft;
  updateDraft: (patch: Partial<ReportDraft>) => void;
  updateAttachments: (update: (current: DraftAttachment[]) => DraftAttachment[]) => void;
  clearDraft: () => void;
  code: Uint8Array | null;
  setCode: (code: Uint8Array | null) => void;
  /** When the report was sent, for the deadlines on the Sent screen. */
  sentAt: Date | null;
  markSent: () => void;
  /** Forgets everything: draft, attachments, code. Zeroes what it can first. */
  reset: () => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [code, setCode] = useState<Uint8Array | null>(null);
  const [sentAt, setSentAt] = useState<Date | null>(null);

  const value = useMemo<Session>(
    () => ({
      draft,
      updateDraft: (patch) => setDraft((current) => ({ ...current, ...patch })),
      updateAttachments: (update) =>
        setDraft((current) => ({ ...current, attachments: update(current.attachments) })),
      clearDraft: () => setDraft(EMPTY_DRAFT),
      code,
      setCode,
      sentAt,
      markSent: () => setSentAt(new Date()),
      reset: () => {
        code?.fill(0);
        for (const attachment of draft.attachments) {
          attachment.data.fill(0);
        }
        setDraft(EMPTY_DRAFT);
        setCode(null);
        setSentAt(null);
      },
    }),
    [draft, code, sentAt],
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
