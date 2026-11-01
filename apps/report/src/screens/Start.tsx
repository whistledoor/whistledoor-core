import { ORPCError } from '@orpc/client';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useTenant } from '../api/useTenant';
import { useI18n } from '../i18n/i18n';
import { Notice } from '../ui/Notice';
import { Screen } from '../ui/Screen';

const EXTERNAL_OFFICE = 'https://www.bak.gv.at';

function ExternalOffice() {
  const { t } = useI18n();
  return (
    <a className="underline" href={EXTERNAL_OFFICE} rel="noreferrer" target="_blank">
      {t.externalOfficeName}
    </a>
  );
}

export function Start() {
  const { t, language } = useI18n();
  const { data: tenant, error, isPending, refetch } = useTenant();

  if (isPending) {
    return <p className="text-muted-foreground">{t.loading}</p>;
  }
  if (!tenant) {
    return error instanceof ORPCError && error.code === 'NOT_FOUND' ? (
      <Notice>{t.unknownAddress}</Notice>
    ) : (
      <Screen>
        <Notice>{t.unreachable}</Notice>
        <Button variant="outline" onClick={() => void refetch()}>
          {t.retry}
        </Button>
      </Screen>
    );
  }

  // An inactive channel takes no reports either way, and its screen names the BAK.
  if (tenant.active && tenant.posterOutdated) {
    return (
      <Screen title={t.posterTitle}>
        <Notice>{t.posterMismatch}</Notice>
        <p>{t.posterAdvice}</p>
        <Button variant="outline" asChild>
          <Link to="/return">{t.haveCode}</Link>
        </Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <Notice>{t.deviceNotice}</Notice>
      <p>{tenant.branding?.intro?.[language]?.trim() || t.intro}</p>
      <div className="text-sm text-muted-foreground">
        <p>
          {t.readers} {tenant.handlers.join(', ')}
        </p>
        <p>
          {tenant.active ? t.externalOffice : t.inactive} <ExternalOffice />.
        </p>
      </div>
      {tenant.active ? (
        <Button asChild>
          <Link to="/kind">{t.newReport}</Link>
        </Button>
      ) : null}
      <Button variant="outline" asChild>
        <Link to="/return">{t.haveCode}</Link>
      </Button>
    </Screen>
  );
}
