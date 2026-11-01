import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { api } from '../api/client';
import { openCase, postMessage } from '../case/case';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';
import { TextForm } from '../ui/TextForm';

const CASE_QUERY = 'case';

function CaseView({ code }: { code: Uint8Array }) {
  const { t, language } = useI18n();
  const { reset } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, refetch } = useQuery({
    queryKey: [CASE_QUERY],
    queryFn: () => openCase(api, code),
    // Decrypted content stays out of the query cache once the case closes.
    gcTime: 0,
  });

  if (!data) {
    return <p>{t.loading}</p>;
  }

  const send = async (text: string, meetingRequest: boolean): Promise<string | undefined> => {
    try {
      await postMessage(api, code, text, data.messages.at(-1)!, meetingRequest);
      await refetch();
      return undefined;
    } catch {
      return t.unreachable;
    }
  };

  return (
    <>
      <p className="step">
        {t.status[data.status]}
        {' · '}
        <button
          type="button"
          className="link"
          onClick={() => {
            queryClient.removeQueries({ queryKey: [CASE_QUERY] });
            reset();
            void navigate({ to: '/' });
          }}
        >
          {t.close}
        </button>
      </p>
      <h1>{t.caseTitle}</h1>
      {data.issues.length > 0 ? <p className="notice">{t.chainWarning}</p> : null}
      {data.messages.map((message) => (
        <article key={message.id} className={`message ${message.role}`}>
          <p className="step">
            {message.role === 'reporter' ? t.roleReporter : t.roleHandler}
            {' · '}
            {new Date(message.createdAt).toLocaleDateString(language)}
          </p>
          <p className="text">{message.text}</p>
        </article>
      ))}
      <TextForm
        label={t.reply}
        submitLabel={t.send}
        multiline
        validate={(value) => (value.trim() ? undefined : t.writeRequired)}
        onSubmit={(value) => send(value, false)}
      />
      <p className="notice">{t.meetingNotice}</p>
      <button type="button" onClick={() => void send(t.meetingText, true)}>
        {t.requestMeeting}
      </button>
    </>
  );
}

export function Case() {
  const { code } = useSession();
  return code ? <CaseView code={code} /> : <Navigate to="/" />;
}
