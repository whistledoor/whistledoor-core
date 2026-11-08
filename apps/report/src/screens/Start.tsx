import { ORPCError } from '@orpc/client';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
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

  const actions = (
    <div className="flex flex-col gap-2">
      {tenant.active ? (
        <Button asChild>
          <Link to="/kind">{t.newReport}</Link>
        </Button>
      ) : null}
      <Button variant="outline" asChild>
        <Link to="/return">{t.haveCode}</Link>
      </Button>
    </div>
  );

  return (
    <Screen title={t.startTitle}>
      <p>{tenant.branding?.intro?.[language]?.trim() || t.intro}</p>
      {tenant.active ? null : (
        <Notice>
          {t.inactive} <ExternalOffice />.
        </Notice>
      )}
      {actions}
      <Notice>{t.deviceNotice}</Notice>
      <Section title={t.whatTitle}>
        <p>{t.whatIntro}</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {t.whatItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{t.whatNote}</p>
      </Section>
      <Section title={t.howTitle}>
        <ol className="flex flex-col gap-2">
          {t.howSteps.map((step, index) => (
            <li key={step.title} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <span>
                <strong className="font-semibold">{step.title}</strong> {step.text}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">{t.sentNext}</p>
      </Section>
      <Section title={t.safeTitle}>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {t.safeItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>
      <Section title={t.readersTitle}>
        <p>
          {t.readers} <span className="font-medium">{tenant.handlers.join(', ')}</span>
        </p>
        {tenant.active ? (
          <p className="text-sm text-muted-foreground">
            {t.externalOffice} <ExternalOffice />.
          </p>
        ) : null}
      </Section>
      {actions}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t pt-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
