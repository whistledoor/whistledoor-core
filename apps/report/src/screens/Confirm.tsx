import { Link, Navigate, useNavigate } from '@tanstack/react-router';
import { api } from '../api/client';
import { useTenant } from '../api/useTenant';
import { toAttachmentFiles } from '../case/attachments';
import { matchesLastGroup, submitReport, toReportContent } from '../case/case';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';
import { Screen } from '../ui/Screen';
import { TextForm } from '../ui/TextForm';

/** Groups 1 to 4 stay hidden; the reporter types group 5. */
const HIDDEN_GROUPS = [1, 2, 3, 4];
/** Group 5 has five characters; room for a stray space or dash. */
const MAX_INPUT = 7;

export function Confirm() {
  const { t } = useI18n();
  const { code, draft, clearDraft } = useSession();
  const { data: tenant } = useTenant();
  const navigate = useNavigate();

  const { category } = draft;
  if (!code || !tenant || !category || tenant.posterOutdated) {
    return <Navigate to="/" />;
  }

  return (
    <Screen
      title={t.confirmTitle}
      meta={
        <>
          <Link className="underline" to="/code">
            {t.showCodeAgain}
          </Link>{' '}
          · {t.stepOf(4, 4)}
        </>
      }
    >
      <p>{t.confirmIntro}</p>
      <p className="text-sm text-muted-foreground">
        {t.kind[draft.kind]} · {t.category[category]}
        {draft.attachments.length > 0 ? ` · ${t.attachmentCount(draft.attachments.length)}` : ''}
      </p>
      <TextForm
        label={t.confirmLabel}
        submitLabel={t.submit}
        mono
        maxLength={MAX_INPUT}
        leading={HIDDEN_GROUPS.map((group) => (
          <span
            key={group}
            aria-hidden="true"
            className="flex h-11 items-center justify-center rounded-md border border-dashed border-input font-mono text-xs text-muted-foreground"
          >
            ••••
          </span>
        ))}
        validate={(value) => (matchesLastGroup(code, value) ? undefined : t.confirmMismatch)}
        onSubmit={async () => {
          try {
            const files = toAttachmentFiles(draft.attachments, t.attachmentDefaultName);
            await submitReport(api, code, toReportContent(draft, category), tenant.tenantPk, files);
          } catch {
            return t.unreachable;
          }
          clearDraft();
          await navigate({ to: '/sent' });
          return undefined;
        }}
      >
        <p className="text-sm text-muted-foreground">{t.confirmHint}</p>
      </TextForm>
    </Screen>
  );
}
