import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeftIcon, CheckIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTenant } from '../api/useTenant';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';
import { Dialog } from './Dialog';
import { Preferences } from './Preferences';
import { TenantMark } from './TenantMark';

/** The four steps of a new report, in order. */
const STEP_ROUTES = ['/kind', '/write', '/code', '/confirm'] as const;
const TOTAL = STEP_ROUTES.length;

export type Step = 1 | 2 | 3 | 4;

interface FlowShellProps {
  step: Step;
  title: string;
  /** The primary action: shown fixed at the bottom on phones, below the form on desktop. */
  action: ReactNode;
  /** The desktop column on the right. */
  aside?: ReactNode;
  children: ReactNode;
}

function backRoute(step: Step): '/' | (typeof STEP_ROUTES)[number] {
  return step === 1 ? '/' : STEP_ROUTES[step - 2]!;
}

function Progress({ step, label }: { step: Step; label: string }) {
  return (
    <>
      <progress className="sr-only" max={TOTAL} value={step} aria-label={label} aria-valuetext={label} />
      <div aria-hidden="true" className="flex gap-1 px-2">
        {STEP_ROUTES.map((route, index) => (
          <span key={route} className={cn('h-1 flex-1 rounded-full', index < step ? 'bg-primary' : 'bg-input')} />
        ))}
      </div>
    </>
  );
}

function StepRail({ step, onCancel }: { step: Step; onCancel: () => void }) {
  const { t } = useI18n();
  const { data: tenant } = useTenant();
  return (
    <nav
      aria-label={t.stepsLabel}
      className="sticky top-0 hidden h-dvh flex-col gap-1 border-r bg-card px-4 py-6 print:hidden lg:flex"
    >
      <div className="flex items-center gap-2.5 px-3 pb-5">
        <TenantMark name={tenant?.name} logoUrl={tenant?.branding?.logoUrl} className="size-8 rounded-[9px]" />
        <p className="min-w-0 text-sm leading-tight font-semibold">
          {tenant?.name}
          <span className="block text-xs font-normal text-muted-foreground">{t.channel}</span>
        </p>
      </div>
      <ol className="flex flex-col gap-1">
        {t.stepNames.map((name, index) => {
          const number = index + 1;
          const done = number < step;
          const current = number === step;
          const dot = (
            <span
              aria-hidden="true"
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold',
                done && 'border-success bg-success text-background',
                current && 'border-primary bg-primary text-primary-foreground',
                !done && !current && 'border-input text-muted-foreground',
              )}
            >
              {done ? <CheckIcon className="size-3" strokeWidth={3} /> : number}
            </span>
          );
          const row = 'flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2 text-sm';
          return (
            <li key={name}>
              {done ? (
                <Link to={STEP_ROUTES[index]!} className={cn(row, 'text-foreground no-underline hover:bg-accent')}>
                  {dot}
                  {name}
                </Link>
              ) : (
                <span
                  aria-current={current ? 'step' : undefined}
                  className={cn(row, current ? 'bg-tint font-semibold text-tint-foreground' : 'text-muted-foreground')}
                >
                  {dot}
                  {name}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-auto flex flex-col gap-2 px-3 text-[13px] text-muted-foreground">
        <Preferences />
        <button
          type="button"
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg text-left hover:text-foreground"
          onClick={onCancel}
        >
          <XIcon aria-hidden="true" className="size-4" />
          {t.cancelReport}
        </button>
        <p>{t.cancelNote}</p>
      </div>
    </nav>
  );
}

/** Steps 1 to 4: progress, back, cancel, and the action that moves on. */
export function FlowShell({ step, title, action, aside, children }: FlowShellProps) {
  const { t } = useI18n();
  const { reset } = useSession();
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);
  const name = t.stepNames[step - 1]!;

  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col lg:grid',
        aside ? 'lg:grid-cols-[260px_minmax(0,1fr)_340px]' : 'lg:grid-cols-[260px_minmax(0,1fr)]',
      )}
    >
      <header className="sticky top-0 z-10 flex flex-col gap-2 border-b bg-card px-3 pt-2 pb-3 print:hidden lg:hidden">
        <div className="flex items-center justify-between">
          <Link
            to={backRoute(step)}
            aria-label={t.back}
            className="inline-flex size-11 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-accent"
          >
            <ArrowLeftIcon aria-hidden="true" className="size-5" />
          </Link>
          <p className="text-[13px] font-medium text-muted-foreground">
            {t.stepOf(step, TOTAL)} · {name}
          </p>
          <button
            type="button"
            aria-label={t.cancelReport}
            className="inline-flex size-11 cursor-pointer items-center justify-center rounded-[10px] text-muted-foreground hover:bg-accent"
            onClick={() => setCancelling(true)}
          >
            <XIcon aria-hidden="true" className="size-5" />
          </button>
        </div>
        <Progress step={step} label={t.progress(step, TOTAL, name)} />
      </header>
      <StepRail step={step} onCancel={() => setCancelling(true)} />
      <main className="flex min-w-0 flex-1 flex-col gap-[18px] px-5 pt-[22px] lg:gap-[22px] lg:px-14 lg:pt-10 lg:pb-10">
        <div>
          <p className="hidden text-[13px] font-medium text-muted-foreground lg:block">{t.stepOf(step, TOTAL)}</p>
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight lg:mt-1 lg:text-[32px]">{title}</h1>
        </div>
        {children}
        <div className="sticky bottom-0 -mx-5 mt-auto flex gap-3 border-t bg-card px-5 pt-3 pb-5 print:hidden lg:static lg:mx-0 lg:justify-between lg:border-0 lg:bg-transparent lg:p-0 lg:pt-2">
          <Button variant="outline" size="cta" className="hidden lg:inline-flex" asChild>
            <Link to={backRoute(step)}>{t.back}</Link>
          </Button>
          {action}
        </div>
      </main>
      {aside ? (
        <aside className="hidden flex-col gap-[18px] bg-info px-7 py-10 print:hidden lg:flex">{aside}</aside>
      ) : null}
      <Dialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        title={t.cancelTitle}
        actions={
          <>
            <Button variant="outline" onClick={() => setCancelling(false)}>
              {t.cancelKeep}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setCancelling(false);
                reset();
                void navigate({ to: '/' });
              }}
            >
              {t.cancelConfirm}
            </Button>
          </>
        }
      >
        <p>{t.cancelText}</p>
      </Dialog>
    </div>
  );
}
