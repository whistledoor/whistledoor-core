import { Link, Navigate, useNavigate } from '@tanstack/react-router';
import { formatCaseCode } from '@whistledoor/crypto';
import { useState } from 'react';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';

function saveAsText(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'fallcode.txt';
  link.click();
  URL.revokeObjectURL(url);
}

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
    <>
      <p className="step">
        <Link to="/write">{t.back}</Link> · {t.stepOf(2, 3)}
      </p>
      <h1>{t.codeTitle}</h1>
      <p className="code mono">{formatted}</p>
      <div className="row">
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(formatted).then(() => setCopied(true))}
        >
          {copied ? t.copied : t.copy}
        </button>
        <button type="button" onClick={() => saveAsText(formatted)}>
          {t.download}
        </button>
        <button type="button" onClick={() => window.print()}>
          {t.print}
        </button>
      </div>
      <p className="notice">{t.codeWarning}</p>
      <button className="primary" type="button" onClick={() => void navigate({ to: '/confirm' })}>
        {t.codeDone}
      </button>
    </>
  );
}
