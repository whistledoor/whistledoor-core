import { useForm } from '@tanstack/react-form';
import { Link, Navigate, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '../api/client';
import { useTenant } from '../api/useTenant';
import { toAttachmentFiles } from '../case/attachments';
import { matchesLastGroup, submitReport, toReportContent } from '../case/case';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';
import { FieldError } from '../ui/FieldError';
import { FlowShell } from '../ui/FlowShell';

/** Groups 1 to 4 stay hidden; the reporter types group 5. */
const HIDDEN_GROUPS = [1, 2, 3, 4];
/** Group 5 has five characters; room for a stray space or dash. */
const MAX_INPUT = 7;
const FORM_ID = 'confirm-form';
const HINT_ID = 'confirm-hint';

export function Confirm() {
  const { t } = useI18n();
  const { code, draft, clearDraft, markSent } = useSession();
  const { data: tenant } = useTenant();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string>();
  const { category } = draft;

  const form = useForm({
    defaultValues: { value: '' },
    onSubmit: async () => {
      if (!code || !tenant || !category) {
        return;
      }
      try {
        const files = toAttachmentFiles(draft.attachments, t.attachmentDefaultName);
        await submitReport(api, code, toReportContent(draft, category), tenant.tenantPk, files);
      } catch {
        setSubmitError(t.unreachable);
        return;
      }
      markSent();
      clearDraft();
      await navigate({ to: '/sent' });
    },
  });

  if (!code || !tenant || !category || tenant.posterOutdated) {
    return <Navigate to="/" />;
  }

  return (
    <FlowShell
      step={4}
      title={t.confirmTitle}
      action={
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" form={FORM_ID} size="cta" disabled={submitting}>
              {t.submit}
            </Button>
          )}
        </form.Subscribe>
      }
    >
      <p className="-mt-3 max-w-[620px]">{t.confirmIntro}</p>
      <p className="text-sm text-muted-foreground">
        {t.kind[draft.kind]} · {t.category[category]}
        {draft.attachments.length > 0 ? ` · ${t.attachmentCount(draft.attachments.length)}` : ''}
      </p>
      <form
        id={FORM_ID}
        noValidate
        className="flex max-w-xl flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="value"
          validators={{ onSubmit: ({ value }) => (matchesLastGroup(code, value) ? undefined : t.confirmMismatch) }}
        >
          {(field) => {
            const error = field.state.meta.errors[0] ?? submitError;
            return (
              <>
                <Label htmlFor={field.name} className="font-semibold">
                  {t.confirmLabel}
                </Label>
                <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.5fr)] items-end gap-1.5">
                  {HIDDEN_GROUPS.map((group) => (
                    <span
                      key={group}
                      aria-hidden="true"
                      className="flex h-[52px] items-center justify-center rounded-[10px] border border-dashed border-field font-mono text-xs text-muted-foreground"
                    >
                      ••••
                    </span>
                  ))}
                  <Input
                    id={field.name}
                    value={field.state.value}
                    maxLength={MAX_INPUT}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={HINT_ID}
                    className="h-[52px] border-2 border-primary px-1 text-center font-mono text-lg tracking-wide uppercase"
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      setSubmitError(undefined);
                      field.handleChange(event.target.value);
                    }}
                  />
                </div>
                <FieldError error={error} />
                <p id={HINT_ID} className="text-sm text-muted-foreground">
                  {t.confirmHint}
                </p>
              </>
            );
          }}
        </form.Field>
      </form>
      <Link className="self-start text-sm underline" to="/code">
        {t.showCodeAgain}
      </Link>
    </FlowShell>
  );
}
