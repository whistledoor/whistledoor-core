import { useForm } from '@tanstack/react-form';
import { Link, useNavigate } from '@tanstack/react-router';
import { generateCaseCode } from '@whistledoor/crypto';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { CATEGORIES } from '../case/categories';
import type { Category } from '../case/categories';
import { useSession } from '../case/session';
import { useI18n } from '../i18n/i18n';
import { FieldError } from '../ui/FieldError';
import { Notice } from '../ui/Notice';
import { Screen } from '../ui/Screen';

export function Write() {
  const { t } = useI18n();
  const { draft, updateDraft, code, setCode } = useSession();
  const navigate = useNavigate();
  const form = useForm({
    defaultValues: { category: draft.category, text: draft.text },
    onSubmit: async () => {
      if (!code) {
        setCode(await generateCaseCode());
      }
      await navigate({ to: '/code' });
    },
  });

  return (
    <Screen
      title={t.writeTitle}
      meta={
        <>
          <Link className="underline" to="/kind">
            {t.back}
          </Link>{' '}
          · {t.stepOf(2, 4)}
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="category"
          validators={{ onSubmit: ({ value }) => (value ? undefined : t.categoryRequired) }}
        >
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>{t.categoryLabel}</Label>
              <NativeSelect
                id={field.name}
                value={field.state.value}
                aria-invalid={field.state.meta.errors.length > 0 ? true : undefined}
                onChange={(event) => {
                  const category = event.target.value as Category | '';
                  field.handleChange(category);
                  updateDraft({ category });
                }}
              >
                <NativeSelectOption value="">{t.categoryChoose}</NativeSelectOption>
                {CATEGORIES.map((category) => (
                  <NativeSelectOption key={category} value={category}>
                    {t.category[category]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError error={field.state.meta.errors[0]} />
            </div>
          )}
        </form.Field>
        <form.Field
          name="text"
          validators={{ onSubmit: ({ value }) => (value.trim() ? undefined : t.writeRequired) }}
        >
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>{t.descriptionLabel}</Label>
              <Textarea
                id={field.name}
                rows={8}
                autoComplete="off"
                value={field.state.value}
                aria-invalid={field.state.meta.errors.length > 0 ? true : undefined}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  updateDraft({ text: event.target.value });
                }}
              />
              <FieldError error={field.state.meta.errors[0]} />
            </div>
          )}
        </form.Field>
        <Notice>{t.writeWarning}</Notice>
        <Button type="submit">{t.next}</Button>
      </form>
    </Screen>
  );
}
