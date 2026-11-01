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
      <p className="rounded-lg bg-muted p-4 text-center font-mono text-sm font-medium whitespace-nowrap sm:text-lg" data-testid="case-code">
        {formatted}
      </p>
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
      <Button className="print:hidden" onClick={() => void navigate({ to: '/confirm' })}>
        {t.codeDone}
      </Button>
    </Screen>
  );
}
