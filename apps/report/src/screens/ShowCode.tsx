import { Navigate, useNavigate } from '@tanstack/react-router';
import { formatCaseCode } from '@whistledoor/crypto';
import { ArrowRightIcon, CopyIcon, DownloadIcon, KeyRoundIcon, PenLineIcon, PrinterIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTenant } from '../api/useTenant';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';
import { Callout } from '../ui/Callout';
import { FlowShell } from '../ui/FlowShell';
import { saveBlob } from '../ui/saveBlob';

function Action({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-input bg-card px-2 text-[13px] font-medium hover:bg-accent lg:min-h-11 lg:flex-row lg:gap-2 lg:px-4 lg:text-sm [&_svg]:size-5 [&_svg]:text-primary lg:[&_svg]:size-[18px]"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

export function ShowCode() {
  const { t } = useI18n();
  const { code } = useSession();
  const { data: tenant } = useTenant();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!code) {
    return <Navigate to="/" />;
  }
  const formatted = formatCaseCode(code);
  const groups = formatted.split('-');

  return (
    <FlowShell
      step={3}
      title={t.codeTitle}
      action={
        <Button size="cta" onClick={() => void navigate({ to: '/confirm' })}>
          {t.codeDone}
          <ArrowRightIcon aria-hidden="true" className="hidden lg:block" />
        </Button>
      }
    >
      <p className="-mt-3 max-w-[620px] text-muted-foreground">{t.codeIntro}</p>
      {/* One element with the whole code, for screen readers, copying by hand and tests. */}
      <p className="sr-only" data-testid="case-code">
        {formatted}
      </p>
      <section
        aria-hidden="true"
        className="flex flex-col gap-3.5 rounded-[20px] bg-code px-4 pt-5 pb-4 text-code-foreground print:border print:bg-white print:text-black lg:self-start lg:rounded-[18px] lg:px-6 lg:py-5"
      >
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.04em] text-code-accent uppercase print:text-black lg:text-[13px]">
          <KeyRoundIcon className="size-3.5 lg:size-4" strokeWidth={2.4} />
          {t.codeCardLabel}
        </p>
        <ol className="grid grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.2fr)] gap-1.5 lg:flex lg:gap-2.5">
          {groups.map((group, index) => {
            const last = index === groups.length - 1;
            return (
              <li key={index} className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    'flex h-[52px] w-full items-center justify-center rounded-[10px] border font-mono text-[17px] font-semibold tracking-[0.06em] lg:h-[54px] lg:w-[92px] lg:text-xl',
                    last
                      ? 'border-2 border-code-accent bg-code-accent/15 lg:w-[108px]'
                      : 'border-white/15 bg-white/8 print:border-black',
                  )}
                >
                  {group}
                </span>
                <span
                  className={cn(
                    'text-center text-[11px] leading-tight lg:text-xs',
                    last ? 'font-semibold text-code-accent' : 'text-code-muted',
                    'print:text-black',
                  )}
                >
                  <span className="hidden lg:inline">{t.codeGroup(index + 1)}</span>
                  <span className="lg:hidden">{index + 1}</span>
                  {last ? ` · ${t.codeGroupAsked}` : ''}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
      <div className="grid grid-cols-3 gap-2 print:hidden lg:flex lg:gap-2.5">
        <Action
          icon={<CopyIcon aria-hidden="true" />}
          label={copied ? t.copied : t.copy}
          onClick={() => void navigator.clipboard.writeText(formatted).then(() => setCopied(true))}
        />
        <Action
          icon={<DownloadIcon aria-hidden="true" />}
          label={t.download}
          onClick={() => saveBlob(new Blob([formatted], { type: 'text/plain' }), 'fallcode.txt')}
        />
        <Action icon={<PrinterIcon aria-hidden="true" />} label={t.print} onClick={() => window.print()} />
      </div>
      <p className="sr-only" aria-live="polite">
        {copied ? t.copied : ''}
      </p>
      <div className="grid gap-3.5 print:hidden lg:grid-cols-2">
        <Callout>{tenant ? t.codeWarning(tenant.name) : t.codeWarning('')}</Callout>
        <Callout tone="info" icon={<PenLineIcon aria-hidden="true" />}>
          {t.codeTip}
        </Callout>
      </div>
      <p className="text-sm text-muted-foreground print:hidden">{t.codeNextHint}</p>
    </FlowShell>
  );
}
