import { CheckIcon, FileTextIcon, ImageIcon, InfoIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { Input } from '@/components/ui/input';
import { addAttachment, attachmentName, exceededLimit, removeAttachment, renameAttachment } from '../case/attachments';
import type { AttachmentLimit, DraftAttachment } from '../case/attachments';
import { readAttachment } from '../case/clean-image';
import { useI18n } from '../i18n/i18n';
import { FieldError } from './FieldError';
import { formatSize } from './format';
import { Notice } from './Notice';

interface AttachmentPickerProps {
  addLabel: string;
  attachments: DraftAttachment[];
  onChange: (update: (current: DraftAttachment[]) => DraftAttachment[]) => void;
  /** Shows the label above the list, for the report form. */
  labelled?: boolean;
}

interface AttachmentRowProps {
  attachment: DraftAttachment;
  name: string;
  onRename: (name: string) => void;
  onRemove: () => void;
}

const iconButton =
  'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-muted-foreground hover:bg-accent hover:text-foreground';

function AttachmentRow({ attachment, name, onRename, onRemove }: AttachmentRowProps) {
  const { t, language } = useI18n();
  const [renaming, setRenaming] = useState(false);
  const Icon = attachment.type.startsWith('image/') ? ImageIcon : FileTextIcon;
  const size = formatSize(attachment.data.length, language);

  return (
    <li className="flex items-center gap-3 rounded-xl border bg-card py-1.5 pr-1.5 pl-3">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info text-info-foreground">
        <Icon className="size-[18px]" />
      </span>
      {renaming ? (
        <Input
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- focus moves to the field the reporter just asked to rename
          autoFocus
          autoComplete="off"
          aria-label={t.attachmentNameLabel}
          defaultValue={name}
          className="flex-1"
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
        <span className="min-w-0 flex-1 text-sm leading-snug">
          <span className="block wrap-anywhere">{name}</span>
          {/* Only what was really done: images are cleaned, other files are not. */}
          {attachment.cleaned ? (
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <CheckIcon aria-hidden="true" className="size-3" strokeWidth={3} />
              {t.attachmentCleaned} · {size}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <InfoIcon aria-hidden="true" className="size-3" />
              {t.attachmentNotCleaned} · {size}
            </span>
          )}
        </span>
      )}
      {renaming ? null : (
        <button type="button" className={iconButton} aria-label={`${t.attachmentRename}: ${name}`} onClick={() => setRenaming(true)}>
          <PencilIcon aria-hidden="true" className="size-[18px]" />
        </button>
      )}
      <button type="button" className={iconButton} aria-label={`${t.attachmentRemove}: ${name}`} onClick={onRemove}>
        <Trash2Icon aria-hidden="true" className="size-[18px]" />
      </button>
    </li>
  );
}

/** Picks files for one report or message. The caller holds them, in memory only. */
export function AttachmentPicker({ addLabel, attachments, onChange, labelled = false }: AttachmentPickerProps) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState(false);
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

  const onDrop = (event: DragEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    setDragging(false);
    if (!adding) {
      void add(Array.from(event.dataTransfer.files));
    }
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={labelled ? 'pb-2 text-sm font-semibold' : 'sr-only'}>
        {t.attachmentsLabel} <span className="font-normal text-muted-foreground">{t.optional}</span>
      </legend>
      {attachments.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {attachments.map((attachment) => {
            const name = attachmentName(attachment, t.attachmentDefaultName);
            return (
              <AttachmentRow
                key={attachment.number}
                attachment={attachment}
                name={name}
                onRename={(newName) => onChange((latest) => renameAttachment(latest, attachment.number, newName))}
                onRemove={() => {
                  setError(undefined);
                  onChange((latest) => removeAttachment(latest, attachment.number));
                }}
              />
            );
          })}
        </ul>
      ) : null}
      <input ref={input} type="file" multiple hidden onChange={onPick} />
      <button
        type="button"
        disabled={adding}
        className={`min-h-12 cursor-pointer rounded-xl border border-dashed border-field px-4 py-2 font-semibold text-link hover:bg-accent disabled:cursor-wait disabled:opacity-60 ${dragging ? 'bg-tint' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {adding ? (
          t.attachmentReading
        ) : (
          <>
            <span className="lg:hidden">{addLabel}</span>
            <span className="hidden lg:inline">{t.attachmentDrop}</span>{' '}
            <span className="text-[13px] font-normal text-muted-foreground">· {t.attachmentHint}</span>
          </>
        )}
      </button>
      <FieldError error={error} />
      {attachments.some((attachment) => !attachment.cleaned) ? <Notice>{t.attachmentWarning}</Notice> : null}
    </fieldset>
  );
}
