import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FieldError } from './FieldError';

interface TextFormProps {
  label: string;
  submitLabel: string;
  multiline?: boolean;
  mono?: boolean;
  /** Returns an error message, or undefined if the value is fine. */
  validate?: (value: string) => string | undefined;
  /** Returns an error message, or undefined on success. */
  onSubmit: (value: string) => Promise<string | undefined> | string | undefined;
}

/** One-field forms: case code, last group, reply. */
export function TextForm({ label, submitLabel, multiline = false, mono = false, validate, onSubmit }: TextFormProps) {
  const [submitError, setSubmitError] = useState<string>();
  const form = useForm({
    defaultValues: { value: '' },
    onSubmit: async ({ value, formApi }) => {
      const error = await onSubmit(value.value);
      setSubmitError(error);
      if (multiline && !error) {
        formApi.reset();
      }
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="value" validators={validate ? { onSubmit: ({ value }) => validate(value) } : {}}>
        {(field) => {
          const error = field.state.meta.errors[0] ?? submitError;
          const props = {
            id: field.name,
            value: field.state.value,
            className: mono ? 'font-mono' : undefined,
            autoComplete: 'off',
            spellCheck: !mono,
            'aria-invalid': error ? true : undefined,
            onBlur: field.handleBlur,
            onChange: (event: { target: { value: string } }) => {
              setSubmitError(undefined);
              field.handleChange(event.target.value);
            },
          };
          return (
            <>
              <Label htmlFor={field.name}>{label}</Label>
              {multiline ? <Textarea rows={4} {...props} /> : <Input {...props} />}
              <FieldError error={error} />
            </>
          );
        }}
      </form.Field>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(submitting) => (
          <Button type="submit" disabled={submitting}>
            {submitLabel}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
