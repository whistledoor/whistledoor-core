import { ORPCError } from '@orpc/client';
import { Link, useNavigate } from '@tanstack/react-router';
import { parseCaseCode } from '@whistledoor/crypto';
import { api } from '../api/client';
import { openCase } from '../case/case';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';
import { TextForm } from '../ui/TextForm';

function tryParse(input: string): Uint8Array | null {
  try {
    return parseCaseCode(input);
  } catch {
    return null;
  }
}

export function ReturnCode() {
  const { t } = useI18n();
  const { setCode } = useSession();
  const navigate = useNavigate();

  return (
    <>
      <p className="step">
        <Link to="/">{t.back}</Link>
      </p>
      <h1>{t.returnTitle}</h1>
      <TextForm
        label={t.returnTitle}
        submitLabel={t.openCase}
        mono
        validate={(value) => (tryParse(value) ? undefined : t.codeTypo)}
        onSubmit={async (value) => {
          const code = tryParse(value)!;
          try {
            await openCase(api, code);
          } catch (error) {
            return error instanceof ORPCError && error.code === 'NOT_FOUND' ? t.noCase : t.unreachable;
          }
          setCode(code);
          await navigate({ to: '/case' });
          return undefined;
        }}
      />
    </>
  );
}
