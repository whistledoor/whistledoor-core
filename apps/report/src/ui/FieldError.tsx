export function FieldError({ error }: { error: unknown }) {
  return error ? (
    <p className="text-sm text-destructive" role="alert">
      {String(error)}
    </p>
  ) : null;
}
