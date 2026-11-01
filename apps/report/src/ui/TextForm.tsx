import { useForm } from '@tanstack/react-form';
import { useState } from 'react';

interface TextFormProps {
  label: string;
  submitLabel: string;
  initialValue?: string;
  multiline?: boolean;
  mono?: boolean;
  /** Returns an error message, or undefined if the value is fine. */
  validate?: (value: string) => string | undefined;
  /** Returns an error message, or undefined on success. */
  onSubmit: (value: string) => Promise<string | undefined> | string | undefined;
  onChange?: (value: string) => void;
}

/** The app's forms each have one field: report, case code, last group, reply. */
export function TextForm({
  label,
  submitLabel,
  initialValue = '',
  multiline = false,
  mono = false,
  validate,
  onSubmit,
  onChange,
}: TextFormProps) {
  const [submitError, setSubmitError] = useState<string>();
  const form = useForm({
    defaultValues: { value: initialValue },
    onSubmit: async ({ value, formApi }) => {
      setSubmitError(await onSubmit(value.value));
      if (multiline && !initialValue) {
        formApi.reset();
      }
    },
  });

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="value"
        validators={validate ? { onSubmit: ({ value }) => validate(value) } : {}}
      >
        {(field) => {
          const error = field.state.meta.errors[0] ?? submitError;
          const props = {
            id: field.name,
            value: field.state.value,
            className: mono ? 'mono' : undefined,
            autoComplete: 'off',
            spellCheck: !mono,
            'aria-invalid': error ? true : undefined,
            onBlur: field.handleBlur,
            onChange: (event: { target: { value: string } }) => {
              setSubmitError(undefined);
              field.handleChange(event.target.value);
              onChange?.(event.target.value);
            },
          };
          return (
            <>
              <label htmlFor={field.name}>{label}</label>
              {multiline ? <textarea rows={8} {...props} /> : <input {...props} />}
              {error ? (
                <p className="error" role="alert">
                  {String(error)}
                </p>
              ) : null}
            </>
          );
        }}
      </form.Field>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(submitting) => (
          <button className="primary" type="submit" disabled={submitting}>
            {submitLabel}
          </button>
        )}
      </form.Subscribe>
    </form>
  );
}
