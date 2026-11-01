import { Link, useNavigate } from '@tanstack/react-router';
import { generateCaseCode } from '@whistledoor/crypto';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';
import { TextForm } from '../ui/TextForm';

export function Write() {
  const { t } = useI18n();
  const { draft, setDraft, code, setCode } = useSession();
  const navigate = useNavigate();

  return (
    <>
      <p className="step">
        <Link to="/">{t.back}</Link> · {t.stepOf(1, 3)}
      </p>
      <h1>{t.writeTitle}</h1>
      <p className="notice">{t.writeWarning}</p>
      <TextForm
        label={t.writeTitle}
        submitLabel={t.next}
        initialValue={draft}
        multiline
        onChange={setDraft}
        validate={(value) => (value.trim() ? undefined : t.writeRequired)}
        onSubmit={async () => {
          if (!code) {
            setCode(await generateCaseCode());
          }
          await navigate({ to: '/code' });
          return undefined;
        }}
      />
    </>
  );
}
