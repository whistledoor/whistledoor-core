import { Link, Navigate, useNavigate } from '@tanstack/react-router';
import { api } from '../api/client';
import { useTenant } from '../api/useTenant';
import { toAttachmentFiles } from '../case/attachments';
import { matchesLastGroup, submitReport, toReportContent } from '../case/case';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';
import { Screen } from '../ui/Screen';
import { TextForm } from '../ui/TextForm';

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
      <p className="text-sm text-muted-foreground">
        {t.kind[draft.kind]} · {t.category[category]}
        {draft.attachments.length > 0 ? ` · ${t.attachmentCount(draft.attachments.length)}` : ''}
      </p>
      <TextForm
        label={t.confirmTitle}
        submitLabel={t.submit}
        mono
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
      />
    </Screen>
  );
}
