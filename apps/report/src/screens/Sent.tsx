import { Navigate, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';
import { Screen } from '../ui/Screen';

export function Sent() {
  const { t } = useI18n();
  const { code, reset } = useSession();
  const navigate = useNavigate();

  if (!code) {
    return <Navigate to="/" />;
  }

  return (
    <Screen title={t.sentTitle}>
      <p>{t.sentNext}</p>
      <p className="text-muted-foreground">{t.sentReturn}</p>
      <Button onClick={() => void navigate({ to: '/case' })}>{t.openCase}</Button>
      <Button
        variant="outline"
        onClick={() => {
          reset();
          void navigate({ to: '/' });
        }}
      >
        {t.done}
      </Button>
    </Screen>
  );
}
