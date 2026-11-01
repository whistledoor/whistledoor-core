import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '../api/client';
import { toAttachmentFiles } from '../case/attachments';
import type { DraftAttachment } from '../case/attachments';
import { openCase, postMessage } from '../case/case';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';
import { AttachmentDownloads } from '../ui/AttachmentDownloads';
import { AttachmentPicker } from '../ui/AttachmentPicker';
import { Notice } from '../ui/Notice';
import { Screen } from '../ui/Screen';
import { TextForm } from '../ui/TextForm';

const CASE_QUERY = 'case';

function CaseView({ code }: { code: Uint8Array }) {
  const { t, language } = useI18n();
  const { reset } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [askingForMeeting, setAskingForMeeting] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState<DraftAttachment[]>([]);
  const { data, refetch } = useQuery({
    queryKey: [CASE_QUERY],
    queryFn: () => openCase(api, code),
    // Decrypted content stays out of the query cache once the case closes.
    gcTime: 0,
  });

  if (!data) {
    return <p className="text-muted-foreground">{t.loading}</p>;
  }

  const send = async (
    text: string,
    meetingRequest: boolean,
    attachments: DraftAttachment[] = [],
  ): Promise<string | undefined> => {
    try {
      const files = toAttachmentFiles(attachments, t.attachmentDefaultName);
      await postMessage(api, code, text, data.messages.at(-1)!, meetingRequest, files);
      await refetch();
      return undefined;
    } catch {
      return t.unreachable;
    }
  };

  return (
    <Screen
      title={t.caseTitle}
      meta={
        <div className="flex justify-between gap-4">
          <span>{t.status[data.status]}</span>
          <button
            type="button"
            className="cursor-pointer underline"
            onClick={() => {
              queryClient.removeQueries({ queryKey: [CASE_QUERY] });
              reset();
              void navigate({ to: '/' });
            }}
          >
            {t.close}
          </button>
        </div>
      }
    >
      {data.issues.length > 0 ? <Notice>{t.chainWarning}</Notice> : null}
      {data.messages.map((message) => (
        <article
          key={message.id}
          className={`rounded-lg border p-3 ${message.role === 'reporter' ? 'ml-6 bg-muted' : 'mr-6'}`}
        >
          <p className="mb-1 text-xs text-muted-foreground">
            {message.role === 'reporter' ? t.roleReporter : t.roleHandler}
            {' · '}
            {new Date(message.createdAt).toLocaleDateString(language)}
            {message.category ? ` · ${t.category[message.category]}` : ''}
          </p>
          <p className="wrap-anywhere whitespace-pre-wrap">{message.text}</p>
          <AttachmentDownloads attachments={message.attachments} code={code} />
        </article>
      ))}
      <TextForm
        label={t.reply}
        submitLabel={t.send}
        multiline
        validate={(value) => (value.trim() ? undefined : t.writeRequired)}
        onSubmit={async (value) => {
          const error = await send(value, false, replyAttachments);
          if (!error) {
            setReplyAttachments([]);
          }
          return error;
        }}
      >
        <AttachmentPicker
          addLabel={t.attachmentAddShort}
          attachments={replyAttachments}
          onChange={setReplyAttachments}
        />
      </TextForm>
      {askingForMeeting ? (
        <section className="flex flex-col gap-3 rounded-lg border p-3">
          <h2 className="font-semibold">{t.meetingTitle}</h2>
          <Notice>{t.meetingNotice}</Notice>
          <p>{t.meetingDetails}</p>
          <Button
            onClick={() => {
              setAskingForMeeting(false);
              void send(t.meetingText, true);
            }}
          >
            {t.requestMeeting}
          </Button>
          <Button variant="outline" onClick={() => setAskingForMeeting(false)}>
            {t.cancel}
          </Button>
        </section>
      ) : (
        <Button variant="outline" onClick={() => setAskingForMeeting(true)}>
          {t.requestMeeting}
        </Button>
      )}
    </Screen>
  );
}

export function Case() {
  const { code } = useSession();
  return code ? <CaseView code={code} /> : <Navigate to="/" />;
}
