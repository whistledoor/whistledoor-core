import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api } from '../api/client';
import { downloadAttachment, downloadName } from '../case/attachments';
import type { Attachment } from '../case/attachments';
import { useI18n } from '../i18n/i18n';
import { FieldError } from './FieldError';
import { saveBlob } from './saveBlob';

function AttachmentRow({ attachment, code }: { attachment: Attachment; code: Uint8Array }) {
  const { t } = useI18n();
  const download = useMutation({
    // Saved here, not returned, so the plaintext never enters the mutation cache.
    mutationFn: async () => {
      const data = await downloadAttachment(api, code, attachment);
      const blob = new Blob([data as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' });
      saveBlob(blob, downloadName(attachment));
    },
    gcTime: 0,
  });

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-sm wrap-anywhere">{attachment.name}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={download.isPending}
          aria-label={`${t.attachmentDownload}: ${attachment.name}`}
          onClick={() => download.mutate()}
        >
          {t.attachmentDownload}
        </Button>
      </div>
      <FieldError error={download.isError ? t.attachmentDownloadFailed : undefined} />
    </li>
  );
}

/** The attachments of one message. */
export function AttachmentDownloads({ attachments, code }: { attachments: Attachment[]; code: Uint8Array }) {
  if (attachments.length === 0) {
    return null;
  }
  return (
    <ul className="mt-3 flex flex-col gap-2 border-t pt-3">
      {attachments.map((attachment) => (
        <AttachmentRow key={attachment.id} attachment={attachment} code={code} />
      ))}
    </ul>
  );
}
