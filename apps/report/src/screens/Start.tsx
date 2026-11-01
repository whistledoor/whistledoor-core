import { Link } from '@tanstack/react-router';
import { ORPCError } from '@orpc/client';
import { useTenant } from '../api/useTenant';
import { useI18n } from '../i18n/i18n';

const EXTERNAL_OFFICE = 'https://www.bak.gv.at';

function ExternalOffice() {
  const { t } = useI18n();
  return (
    <a href={EXTERNAL_OFFICE} rel="noreferrer" target="_blank">
      {t.externalOfficeName}
    </a>
  );
}

export function Start() {
  const { t } = useI18n();
  const { data: tenant, error, isPending, refetch } = useTenant();

  if (isPending) {
    return <p>{t.loading}</p>;
  }
  if (!tenant) {
    return error instanceof ORPCError && error.code === 'NOT_FOUND' ? (
      <p className="notice">{t.unknownAddress}</p>
    ) : (
      <>
        <p className="notice">{t.unreachable}</p>
        <button type="button" onClick={() => void refetch()}>
          {t.retry}
        </button>
      </>
    );
  }

  return (
    <>
      <p className="notice">{t.deviceNotice}</p>
      <p>{t.intro}</p>
      <p>
        {t.readers} {tenant.handlers.join(', ')}
      </p>
      <p>
        {tenant.active ? t.externalOffice : t.inactive} <ExternalOffice />.
      </p>
      {tenant.active ? (
        <Link className="button primary" to="/write">
          {t.newReport}
        </Link>
      ) : null}
      <Link className="button" to="/return">
        {t.haveCode}
      </Link>
    </>
  );
}
