import { Navigate, useNavigate } from '@tanstack/react-router';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';

export function Sent() {
  const { t } = useI18n();
  const { code, reset } = useSession();
  const navigate = useNavigate();

  if (!code) {
    return <Navigate to="/" />;
  }

  return (
    <>
      <h1>{t.sentTitle}</h1>
      <p>{t.sentNext}</p>
      <button className="primary" type="button" onClick={() => void navigate({ to: '/case' })}>
        {t.openCase}
      </button>
      <button
        type="button"
        onClick={() => {
          reset();
          void navigate({ to: '/' });
        }}
      >
        {t.done}
      </button>
    </>
  );
}
