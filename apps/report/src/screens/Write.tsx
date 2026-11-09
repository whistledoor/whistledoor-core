import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { generateCaseCode } from '@whistledoor/crypto';
import { ArrowRightIcon, CheckIcon, InfoIcon, ShieldIcon } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTenant } from '../api/useTenant';
import { CATEGORIES } from '../case/categories';
import { appendPrompt } from '../case/prompts';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';
import { AttachmentPicker } from '../ui/AttachmentPicker';
import { Callout } from '../ui/Callout';
import { FieldError } from '../ui/FieldError';
import { FlowShell } from '../ui/FlowShell';

const FORM_ID = 'write-form';
const CATEGORY_ERROR_ID = 'category-error';

function Check({ ok, title, text }: { ok: boolean; title: string; text: string }) {
  return (
    <li className="flex gap-2.5 text-sm">
      {ok ? (
        <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={3} />
      ) : (
        <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <span>
        <strong className="font-semibold">{title}</strong>
        <span className="block text-muted-foreground">{text}</span>
      </span>
    </li>
  );
}

function Protection() {
  const { t, language } = useI18n();
  const { draft } = useSession();
  const { data: tenant } = useTenant();
  const { attachments } = draft;
  const allCleaned = attachments.every((attachment) => attachment.cleaned);
  const files = allCleaned ? t.protectionCleaned : t.protectionNotCleaned;
  const names = new Intl.ListFormat(language, { type: 'conjunction' }).format(tenant?.handlers ?? []);

  return (
    <>
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <ShieldIcon aria-hidden="true" className="size-[18px] text-primary" />
        {t.protectionTitle}
      </h2>
      <ul className="flex flex-col gap-3 rounded-[14px] bg-card p-[18px]">
        <Check ok {...t.protectionKind[draft.kind]} />
        {attachments.length > 0 ? <Check ok={allCleaned} {...files} /> : null}
        <Check ok {...t.protectionNotSent} />
      </ul>
      <Callout>{t.writeWarning}</Callout>
      {names ? <p className="text-[13px] text-muted-on-tint">{t.readersOnly(names)}</p> : null}
    </>
  );
}

export function Write() {
  const { t } = useI18n();
  const { draft, updateDraft, updateAttachments, code, setCode } = useSession();
  const navigate = useNavigate();
  const description = useRef<HTMLTextAreaElement>(null);
  const firstCategory = useRef<HTMLInputElement>(null);
  const form = useForm({
    defaultValues: { category: draft.category, text: draft.text },
    onSubmit: async () => {
      if (!code) {
        setCode(await generateCaseCode());
      }
      await navigate({ to: '/code' });
    },
    onSubmitInvalid: ({ formApi }) => {
      // Focus goes to the first field with an error.
      if (formApi.getFieldMeta('category')?.errors.length) {
        firstCategory.current?.focus();
      } else {
        description.current?.focus();
      }
    },
  });

  return (
    <FlowShell
      step={2}
      title={t.writeTitle}
      aside={<Protection />}
      action={
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" form={FORM_ID} size="cta" disabled={submitting}>
              {t.next}
              <ArrowRightIcon aria-hidden="true" className="hidden lg:block" />
            </Button>
          )}
        </form.Subscribe>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="flex flex-col gap-[18px] lg:gap-[22px]"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="category"
          validators={{ onSubmit: ({ value }) => (value ? undefined : t.categoryRequired) }}
        >
          {(field) => {
            const error = field.state.meta.errors[0];
            return (
              <fieldset
                aria-describedby={error ? CATEGORY_ERROR_ID : undefined}
                aria-invalid={error ? true : undefined}
                className="flex flex-col gap-2"
              >
                <legend className="pb-2 text-sm font-semibold">{t.categoryLabel}</legend>
                <div className="flex flex-wrap gap-1.5 lg:gap-2">
                  {CATEGORIES.map((category, index) => (
                    <label
                      key={category}
                      className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-input bg-card px-3.5 text-sm has-checked:border-primary has-checked:bg-primary has-checked:font-semibold has-checked:text-primary-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
                    >
                      <input
                        ref={index === 0 ? firstCategory : undefined}
                        type="radio"
                        name={field.name}
                        value={category}
                        checked={field.state.value === category}
                        className="sr-only"
                        onChange={() => {
                          field.handleChange(category);
                          updateDraft({ category });
                        }}
                      />
                      {t.category[category]}
                    </label>
                  ))}
                </div>
                <div id={CATEGORY_ERROR_ID}>
                  <FieldError error={error} />
                </div>
              </fieldset>
            );
          }}
        </form.Field>
        <form.Field
          name="text"
          validators={{ onSubmit: ({ value }) => (value.trim() ? undefined : t.writeRequired) }}
        >
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name} className="font-semibold">
                {t.descriptionLabel}
              </Label>
              <Textarea
                ref={description}
                id={field.name}
                rows={7}
                autoComplete="off"
                className="min-h-[170px] resize-y"
                value={field.state.value}
                aria-invalid={field.state.meta.errors.length > 0 ? true : undefined}
                aria-describedby="description-prompts"
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  updateDraft({ text: event.target.value });
                }}
              />
              <FieldError error={field.state.meta.errors[0]} />
              <div id="description-prompts" className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] text-muted-foreground">{t.promptsLabel}</span>
                {t.prompts.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    aria-label={t.promptAdd(prompt.button)}
                    className="min-h-11 cursor-pointer rounded-lg border border-dashed border-field bg-card px-2.5 text-[13px] text-info-foreground hover:bg-accent"
                    onClick={() => {
                      const text = appendPrompt(field.state.value, prompt.label);
                      field.handleChange(text);
                      updateDraft({ text });
                      // The caret goes after the label, ready to type the answer.
                      requestAnimationFrame(() => {
                        const area = description.current;
                        area?.focus();
                        area?.setSelectionRange(text.length, text.length);
                      });
                    }}
                  >
                    + {prompt.button}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form.Field>
        <AttachmentPicker labelled addLabel={t.attachmentAdd} attachments={draft.attachments} onChange={updateAttachments} />
        <div className="lg:hidden">
          <Callout>{t.writeWarning}</Callout>
        </div>
      </form>
    </FlowShell>
  );
}
