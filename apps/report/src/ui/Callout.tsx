import { InfoIcon, TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'warn' | 'info' | 'tint';

const TONES: Record<Tone, string> = {
  warn: 'bg-notice text-notice-foreground',
  info: 'bg-info text-info-foreground',
  tint: 'bg-tint text-tint-foreground',
};

interface CalloutProps {
  tone?: Tone;
  /** Replaces the default icon. */
  icon?: ReactNode;
  /** Announce it, for errors that appear after an action. */
  alert?: boolean;
  className?: string;
  children: ReactNode;
}

/** A coloured box with an icon: warnings, hints and notes. */
export function Callout({ tone = 'warn', icon, alert = false, className, children }: CalloutProps) {
  const Icon = tone === 'warn' ? TriangleAlertIcon : InfoIcon;
  return (
    <div
      role={alert ? 'alert' : undefined}
      className={cn('flex gap-3 rounded-[14px] px-4 py-3 text-sm [&_svg]:mt-0.5 [&_svg]:size-[18px] [&_svg]:shrink-0', TONES[tone], className)}
    >
      {icon ?? <Icon aria-hidden="true" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
