import { Link, Navigate, useNavigate } from '@tanstack/react-router';
import { formatCaseCode } from '@whistledoor/crypto';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';
import { Notice } from '../ui/Notice';
import { saveBlob } from '../ui/saveBlob';
import { Screen } from '../ui/Screen';

export function ShowCode() {
  const { t } = useI18n();
  const { code } = useSession();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!code) {
    return <Navigate to="/" />;
  }
  const formatted = formatCaseCode(code);

  return (
    <Screen
      title={t.codeTitle}
      meta={
        <>
          <Link className="underline" to="/write">
            {t.back}
          </Link>{' '}
          · {t.stepOf(3, 4)}
        </>
      }
    >
      <p>{t.codeIntro}</p>
      {/* One element with the whole code, for copying by hand and for tests. */}
      <p className="sr-only" data-testid="case-code">
        {formatted}
      </p>
      <ol className="grid grid-cols-5 gap-1.5" aria-hidden="true">
        {formatted.split('-').map((group, index, groups) => (
          <li key={index} className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">{index + 1}</span>
            <span
              className={`w-full rounded-lg border py-2.5 text-center font-mono text-sm font-semibold sm:text-lg ${
                index === groups.length - 1 ? 'border-2 border-foreground bg-muted' : 'border-input'
              }`}
            >
              {group}
            </span>
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 print:hidden">
        <Button
          variant="outline"
          onClick={() => void navigator.clipboard.writeText(formatted).then(() => setCopied(true))}
        >
          {copied ? t.copied : t.copy}
        </Button>
        <Button variant="outline" onClick={() => saveBlob(new Blob([formatted], { type: 'text/plain' }), 'fallcode.txt')}>
          {t.download}
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          {t.print}
        </Button>
      </div>
      <Notice>{t.codeWarning}</Notice>
      <p className="rounded-lg border p-3 text-sm print:hidden">{t.codeNextHint}</p>
      <Button className="print:hidden" onClick={() => void navigate({ to: '/confirm' })}>
        {t.codeDone}
      </Button>
    </Screen>
  );
}
