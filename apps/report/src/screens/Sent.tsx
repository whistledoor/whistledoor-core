import { Navigate, useNavigate } from '@tanstack/react-router';
import { CheckIcon, KeyRoundIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTenant } from '../api/useTenant';
import { deadlines } from '../case/deadlines';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';
import { Callout } from '../ui/Callout';
import { formatDate, localeFor } from '../ui/format';
import { PageShell } from '../ui/PageShell';

interface Milestone {
  when: string;
  what: string;
  state: 'done' | 'next' | 'later';
}

function Timeline({ milestones }: { milestones: Milestone[] }) {
  const { t } = useI18n();
  return (
    <section
      aria-labelledby="timeline"
      className="flex flex-col gap-3.5 rounded-2xl border bg-card p-[18px] lg:gap-6 lg:rounded-[20px] lg:p-8"
    >
      <h2 id="timeline" className="text-lg font-semibold">
        {t.timelineTitle}
      </h2>
      <ol className="flex flex-col gap-3.5 lg:gap-6">
        {milestones.map(({ when, what, state }) => (
          <li key={what} className="grid grid-cols-[28px_1fr] gap-3 lg:grid-cols-[32px_1fr] lg:gap-4">
            <span
              aria-hidden="true"
              className={cn(
                'flex size-7 items-center justify-center rounded-full lg:size-8',
                state === 'done' && 'bg-success text-background',
                state === 'next' && 'border-2 border-primary',
                state === 'later' && 'border-2 border-dashed border-field',
              )}
            >
              {state === 'done' ? <CheckIcon className="size-3.5" strokeWidth={3} /> : null}
            </span>
            <span>
              <strong className="block font-semibold">{when}</strong>
              <span className="text-muted-foreground">{what}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="border-t pt-4 text-sm text-muted-foreground">{t.sentNoNotification}</p>
    </section>
  );
}

export function Sent() {
  const { t, language } = useI18n();
  const { code, sentAt, reset } = useSession();
  const { data: tenant } = useTenant();
  const navigate = useNavigate();

  if (!code || !sentAt) {
    return <Navigate to="/" />;
  }

  const locale = localeFor(language, navigator.languages);
  const date = (value: Date): string => formatDate(value, locale);
  const { acknowledgeBy, feedbackBy } = deadlines(sentAt);
  const names = new Intl.ListFormat(locale, { type: 'conjunction' }).format(tenant?.handlers ?? []);
  const milestones: Milestone[] = [
    { when: t.timelineToday(date(sentAt)), what: t.timelineSent, state: 'done' },
    { when: t.timelineBy(date(acknowledgeBy)), what: t.timelineAcknowledge, state: 'next' },
    { when: t.timelineBy(date(feedbackBy)), what: t.timelineFeedback, state: 'later' },
  ];

  return (
    <PageShell wide>
      <div className="grid gap-[22px] lg:my-auto lg:grid-cols-[minmax(0,1fr)_480px] lg:items-center lg:gap-16">
        {/* On phones the timeline comes right after the title and the buttons last. */}
        <div className="contents lg:flex lg:flex-col lg:gap-6">
          <span
            aria-hidden="true"
            className="flex size-[72px] items-center justify-center rounded-full bg-success-surface text-success lg:size-[88px]"
          >
            <CheckIcon className="size-9 lg:size-11" strokeWidth={2.4} />
          </span>
          <div>
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight lg:text-[44px]">{t.sentTitle}</h1>
            {names ? <p className="mt-2 max-w-[520px] text-muted-foreground lg:mt-3 lg:text-[17px]">{t.sentStored(names)}</p> : null}
          </div>
          {/* No part of the case code here: someone looking over a shoulder must not learn it. */}
          <Callout tone="tint" icon={<KeyRoundIcon aria-hidden="true" />} className="order-1 max-w-[520px] lg:order-none">
            {t.sentReturn}
          </Callout>
          <div className="order-2 flex flex-col gap-2.5 lg:order-none lg:flex-row lg:gap-3">
            <Button size="cta" onClick={() => void navigate({ to: '/case' })}>
              {t.toCase}
            </Button>
            <Button
              variant="outline"
              size="cta"
              onClick={() => {
                reset();
                void navigate({ to: '/' });
              }}
            >
              {t.done}
            </Button>
          </div>
          <p className="order-1 text-sm text-muted-foreground lg:order-none">{t.sentSharedDevice}</p>
        </div>
        <Timeline milestones={milestones} />
      </div>
    </PageShell>
  );
}
