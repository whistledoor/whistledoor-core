import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addAttachment, attachmentName, exceededLimit, removeAttachment, renameAttachment } from '../case/attachments';
import type { AttachmentLimit, DraftAttachment } from '../case/attachments';
import { readAttachment } from '../case/clean-image';
import { useI18n } from '../i18n/i18n';
import { FieldError } from './FieldError';
import { Notice } from './Notice';

interface AttachmentPickerProps {
  addLabel: string;
  attachments: DraftAttachment[];
  onChange: (update: (current: DraftAttachment[]) => DraftAttachment[]) => void;
}

interface AttachmentRowProps {
  name: string;
  onRename: (name: string) => void;
  onRemove: () => void;
}

function AttachmentRow({ name, onRename, onRemove }: AttachmentRowProps) {
  const { t } = useI18n();
  const [renaming, setRenaming] = useState(false);

  return (
    <li className="flex items-center justify-between gap-2">
      {renaming ? (
        <Input
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- focus moves to the field the reporter just asked to rename
          autoFocus
          autoComplete="off"
          aria-label={t.attachmentNameLabel}
          defaultValue={name}
          onBlur={(event) => {
            onRename(event.target.value);
            setRenaming(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              // Enter would otherwise submit the surrounding form.
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      ) : (
        <>
          <span className="min-w-0 text-sm wrap-anywhere">{name}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            aria-label={`${t.attachmentRename}: ${name}`}
            onClick={() => setRenaming(true)}
          >
            {t.attachmentRename}
          </Button>
        </>
      )}
      <Button type="button" variant="ghost" size="sm" aria-label={`${t.attachmentRemove}: ${name}`} onClick={onRemove}>
        {t.attachmentRemove}
      </Button>
    </li>
  );
}

/** Picks files for one report or message. The caller holds them, in memory only. */
export function AttachmentPicker({ addLabel, attachments, onChange }: AttachmentPickerProps) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();

  const limitError = (limit: AttachmentLimit, name: string): string =>
    limit === 'file' ? t.attachmentFileTooLarge(name) : t.attachmentMessageTooLarge(name);

  const add = async (files: File[]): Promise<void> => {
    setAdding(true);
    setError(undefined);
    // Adding is blocked meanwhile, so this list can only miss removals, which free space.
    let current = attachments;
    for (const file of files) {
      // Checked before reading, so an oversized file is never decoded.
      const tooLarge = exceededLimit(file.size, current);
      if (tooLarge) {
        setError(limitError(tooLarge, file.name));
        break;
      }
      try {
        const added = await readAttachment(file);
        // Checked again, because re-encoding changes the size.
        const stillTooLarge = exceededLimit(added.data.length, current);
        if (stillTooLarge) {
          setError(limitError(stillTooLarge, file.name));
          break;
        }
        current = addAttachment(current, added);
        onChange((latest) => addAttachment(latest, added));
      } catch {
        setError(t.attachmentImageFailed(file.name));
        break;
      }
    }
    setAdding(false);
  };

  const onPick = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? []);
    // Lets the reporter pick the same file again.
    event.target.value = '';
    void add(files);
  };

  return (
    <div className="flex flex-col gap-2">
      {attachments.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.number}
              name={attachmentName(attachment, t.attachmentDefaultName)}
              onRename={(name) => onChange((latest) => renameAttachment(latest, attachment.number, name))}
              onRemove={() => {
                setError(undefined);
                onChange((latest) => removeAttachment(latest, attachment.number));
              }}
            />
          ))}
        </ul>
      ) : null}
      <input ref={input} type="file" multiple hidden onChange={onPick} />
      <Button type="button" variant="outline" disabled={adding} onClick={() => input.current?.click()}>
        {addLabel}
      </Button>
      <p className="text-xs text-muted-foreground">{t.attachmentHint}</p>
      <FieldError error={error} />
      {attachments.some((attachment) => !attachment.cleaned) ? <Notice>{t.attachmentWarning}</Notice> : null}
    </div>
  );
}
