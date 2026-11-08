import { ORPCError } from '@orpc/client';
import { Link } from '@tanstack/react-router';
import { ArrowRightIcon, ChevronDownIcon, ClockIcon, LockIcon, ShieldIcon, SmartphoneIcon, UserXIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useTenant } from '../api/useTenant';
import type { CheckedTenant } from '../api/useTenant';
import { useI18n } from '../i18n/i18n';
import { AppHeader } from '../ui/AppHeader';
import { Callout } from '../ui/Callout';
import { Dialog } from '../ui/Dialog';
import { initials } from '../ui/format';
import { Notice } from '../ui/Notice';
import { PageShell } from '../ui/PageShell';

const EXTERNAL_OFFICE = 'https://www.bak.gv.at';
const TRUST_ICONS = [UserXIcon, ShieldIcon, ClockIcon];

function ExternalOffice() {
  const { t } = useI18n();
  return (
    <a className="underline" href={EXTERNAL_OFFICE} rel="noreferrer" target="_blank">
      {t.externalOfficeName}
    </a>
  );
}

function StateScreen({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <PageShell>
      {title ? <h1 className="text-[26px] leading-tight font-semibold tracking-tight">{title}</h1> : null}
      {children}
    </PageShell>
  );
}

function Actions({ tenant }: { tenant: CheckedTenant }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2.5 lg:flex-row lg:justify-center lg:gap-3">
      {tenant.active ? (
        <Button size="cta" asChild>
          <Link to="/kind" className="text-primary-foreground no-underline">
            {t.newReport}
            <ArrowRightIcon aria-hidden="true" className="size-[18px]" />
          </Link>
        </Button>
      ) : null}
      <Button variant="outline" size="cta" asChild>
        <Link to="/return" className="text-foreground no-underline">
          {t.haveCode}
        </Link>
      </Button>
    </div>
  );
}

function Readers({ tenant }: { tenant: CheckedTenant }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2.5 pb-3.5">
      <ul className="flex flex-col gap-2.5">
        {tenant.handlers.map((name) => (
          <li key={name} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-full bg-tint text-[13px] font-bold text-tint-foreground"
            >
              {initials(name)}
            </span>
            {name}
          </li>
        ))}
      </ul>
      {tenant.active ? (
        <p className="text-sm text-muted-foreground">
          {t.externalOffice} <ExternalOffice />.
        </p>
      ) : null}
    </div>
  );
}

function WhatContent() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2.5 pb-3.5">
      <p className="text-sm text-muted-foreground">{t.whatIntro}</p>
      <ul className="flex flex-wrap gap-1.5">
        {t.whatItems.map((item) => (
          <li key={item} className="inline-flex min-h-8 items-center rounded-full bg-info px-3 text-[13px] text-info-foreground">
            {item}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">{t.whatNote}</p>
    </div>
  );
}

function SafeContent() {
  const { t } = useI18n();
  return (
    <ul className="flex list-disc flex-col gap-1 pb-3.5 pl-5 text-sm text-muted-foreground">
      {t.safeItems.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Question({ title, open = false, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group border-t">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between py-1 font-semibold">
        {title}
        <ChevronDownIcon aria-hidden="true" className="size-[18px] transition-transform group-open:rotate-180" />
      </summary>
      {children}
    </details>
  );
}

function HowSteps({ desktop = false }: { desktop?: boolean }) {
  const { t } = useI18n();
  return (
    <ol className={desktop ? 'contents' : 'flex flex-col gap-3'}>
      {t.howSteps.map((step, index) => (
        <li key={step.title} className={desktop ? 'flex flex-col gap-1.5' : 'grid grid-cols-[28px_1fr] gap-3'}>
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-full bg-tint text-[13px] font-semibold text-tint-foreground"
          >
            {index + 1}
          </span>
          {desktop ? (
            <>
              <strong className="font-semibold">{step.title.replace(/[.,]$/, '')}</strong>
              <span className="text-sm text-muted-foreground">{step.text}</span>
            </>
          ) : (
            <span>
              <strong className="font-semibold">{step.title}</strong>{' '}
              <span className="text-muted-foreground">{step.text}</span>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function MobileStart({ tenant, intro }: { tenant: CheckedTenant; intro: string }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col lg:hidden">
      <AppHeader />
      <main className="flex flex-1 flex-col gap-[22px] px-5 pt-7 pb-6">
        <div className="flex flex-col gap-3.5">
          <Pill />
          <h1 className="text-[31px] leading-[1.12] font-semibold tracking-[-0.02em]">{t.startTitle}</h1>
          <p className="text-muted-foreground">{intro}</p>
        </div>
        <Inactive tenant={tenant} />
        <div className="flex flex-col gap-2.5">
          <Actions tenant={tenant} />
          {tenant.active ? <p className="text-center text-[13px] text-muted-foreground">{t.duration}</p> : null}
        </div>
        <ul className="grid grid-cols-3 gap-2">
          {t.trust.map((tile, index) => {
            const Icon = TRUST_ICONS[index]!;
            return (
              <li key={tile.title} className="flex flex-col gap-1.5 rounded-[14px] border bg-card p-3 text-[13px] leading-snug">
                <Icon aria-hidden="true" className="size-5 text-primary" />
                <strong className="font-semibold">{tile.title}</strong>
                <span className="text-muted-foreground">{tile.text}</span>
              </li>
            );
          })}
        </ul>
        <Callout tone="info" icon={<SmartphoneIcon aria-hidden="true" />}>
          <strong className="font-semibold">{t.deviceTitle}</strong> {t.deviceNotice}
        </Callout>
        <section aria-labelledby="how-mobile" className="flex flex-col gap-3 rounded-2xl border bg-card p-[18px]">
          <h2 id="how-mobile" className="text-lg font-semibold tracking-tight">
            {t.howTitle}
          </h2>
          <HowSteps />
        </section>
        <section aria-label={t.faqLabel} className="flex flex-col border-b">
          <Question title={t.whatTitle} open>
            <WhatContent />
          </Question>
          <Question title={t.safeTitle}>
            <SafeContent />
          </Question>
          <Question title={t.readersTitle} open>
            <Readers tenant={tenant} />
          </Question>
        </section>
      </main>
      <div className="sticky bottom-0 flex flex-col gap-2 border-t bg-card px-5 pt-3 pb-5">
        {tenant.active ? (
          <Button size="cta" asChild>
            <Link to="/kind" className="text-primary-foreground no-underline">
              {t.newReport}
            </Link>
          </Button>
        ) : null}
        <p className="text-center text-xs text-muted-foreground">{t.providedBy}</p>
      </div>
    </div>
  );
}

function DesktopStart({ tenant, intro }: { tenant: CheckedTenant; intro: string }) {
  const { t } = useI18n();
  const [question, setQuestion] = useState<'what' | 'safe' | null>(null);
  const link = 'cursor-pointer text-link underline-offset-2 hover:underline';

  return (
    <div className="hidden min-h-dvh flex-col lg:flex">
      <AppHeader plain />
      <main className="flex flex-1 flex-col items-center px-12">
        <section className="flex w-full max-w-[760px] flex-col items-center gap-5 pt-[72px] text-center">
          <Pill />
          <h1 className="text-[50px] leading-[1.08] font-semibold tracking-[-0.025em]">{t.startTitle}</h1>
          <p className="max-w-[600px] text-lg text-muted-foreground">{intro}</p>
        </section>
        <div className="mt-9 flex w-full max-w-[760px] flex-col items-center gap-3">
          <Inactive tenant={tenant} />
          <Actions tenant={tenant} />
          {tenant.active ? <p className="text-sm text-muted-foreground">{t.duration}</p> : null}
        </div>
        <ul className="mt-[22px] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {t.trustLine.map((item, index) => (
            <li key={item} className="flex items-center gap-3">
              {index > 0 ? <span aria-hidden="true" className="size-1 rounded-full bg-field" /> : null}
              {index === 0 ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-success">
                  <LockIcon aria-hidden="true" className="size-3.5" strokeWidth={2.4} />
                  {item}
                </span>
              ) : (
                item
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-sm text-muted-foreground">{t.deviceNoticeShort}</p>
        <section
          aria-labelledby="how-desktop"
          className="mt-auto grid w-full max-w-[1040px] grid-cols-[200px_repeat(4,minmax(0,1fr))] gap-7 border-t pt-10 pb-9"
        >
          <h2 id="how-desktop" className="text-base font-semibold">
            {t.howTitle}
          </h2>
          <HowSteps desktop />
        </section>
      </main>
      <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t bg-card px-12 py-3 text-[13px] text-muted-foreground">
        <p>
          {t.readers} <span className="text-foreground">{tenant.handlers.join(', ')}</span>
          {tenant.active ? (
            <>
              {' · '}
              {t.externalOfficeShort} <ExternalOffice />
            </>
          ) : null}
        </p>
        <span className="flex-1" />
        <button type="button" className={`min-h-11 ${link}`} onClick={() => setQuestion('what')}>
          {t.whatTitle}
        </button>
        <button type="button" className={`min-h-11 ${link}`} onClick={() => setQuestion('safe')}>
          {t.safeTitle}
        </button>
        <span>{t.providedBy}</span>
      </footer>
      <Dialog
        open={question !== null}
        onClose={() => setQuestion(null)}
        title={question === 'safe' ? t.safeTitle : t.whatTitle}
        actions={
          <Button variant="outline" onClick={() => setQuestion(null)}>
            {t.close}
          </Button>
        }
      >
        {question === 'safe' ? <SafeContent /> : <WhatContent />}
      </Dialog>
    </div>
  );
}

function Pill() {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-success-surface px-2.5 py-1 text-xs font-semibold text-success lg:self-center">
      <LockIcon aria-hidden="true" className="size-[13px]" strokeWidth={2.4} />
      {t.encryptedPill}
    </span>
  );
}

function Inactive({ tenant }: { tenant: CheckedTenant }) {
  const { t } = useI18n();
  return tenant.active ? null : (
    <Notice>
      {t.inactive} <ExternalOffice />.
    </Notice>
  );
}

export function Start() {
  const { t, language } = useI18n();
  const { data: tenant, error, isPending, refetch } = useTenant();

  if (isPending) {
    return (
      <StateScreen>
        <p className="text-muted-foreground">{t.loading}</p>
      </StateScreen>
    );
  }
  if (!tenant) {
    return error instanceof ORPCError && error.code === 'NOT_FOUND' ? (
      <StateScreen>
        <Notice>{t.unknownAddress}</Notice>
      </StateScreen>
    ) : (
      <StateScreen>
        <Notice alert>{t.unreachable}</Notice>
        <Button variant="outline" size="cta" onClick={() => void refetch()}>
          {t.retry}
        </Button>
      </StateScreen>
    );
  }

  // An inactive channel takes no reports either way, and its screen names the BAK.
  if (tenant.active && tenant.posterOutdated) {
    return (
      <StateScreen title={t.posterTitle}>
        <Notice alert>{t.posterMismatch}</Notice>
        <p>{t.posterAdvice}</p>
        <Button variant="outline" size="cta" asChild>
          <Link to="/return" className="text-foreground no-underline">
            {t.haveCode}
          </Link>
        </Button>
      </StateScreen>
    );
  }

  const intro = tenant.branding?.intro?.[language]?.trim() || t.intro(tenant.name);
  return (
    <>
      <MobileStart tenant={tenant} intro={intro} />
      <DesktopStart tenant={tenant} intro={intro} />
    </>
  );
}
