import { Link, Navigate, useNavigate } from '@tanstack/react-router';
import { api } from '../api/client';
import { useTenant } from '../api/useTenant';
import { matchesLastGroup, submitReport } from '../case/case';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';
import { TextForm } from '../ui/TextForm';

export function Confirm() {
  const { t } = useI18n();
  const { code, draft, setDraft } = useSession();
  const { data: tenant } = useTenant();
  const navigate = useNavigate();

  if (!code || !tenant) {
    return <Navigate to="/" />;
  }

  return (
    <>
      <p className="step">
        <Link to="/code">{t.showCodeAgain}</Link> · {t.stepOf(3, 3)}
      </p>
      <h1>{t.confirmTitle}</h1>
      <TextForm
        label={t.confirmTitle}
        submitLabel={t.submit}
        mono
        validate={(value) => (matchesLastGroup(code, value) ? undefined : t.confirmMismatch)}
        onSubmit={async () => {
          try {
            await submitReport(api, code, { text: draft }, tenant.tenantPk);
          } catch {
            return t.unreachable;
          }
          setDraft('');
          await navigate({ to: '/sent' });
          return undefined;
        }}
      />
    </>
  );
}
