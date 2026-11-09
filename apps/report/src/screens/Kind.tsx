import { Link } from '@tanstack/react-router';
import { ArrowRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '../case/session';
import type { ReportKind } from '../case/categories';
import { useI18n } from '../i18n/i18n';
import { FlowShell } from '../ui/FlowShell';

const KINDS: readonly ReportKind[] = ['anonymous', 'confidential'];

export function Kind() {
  const { t } = useI18n();
  const { draft, updateDraft } = useSession();

  return (
    <FlowShell
      step={1}
      title={t.kindTitle}
      action={
        <Button size="cta" asChild>
          <Link to="/write" className="text-primary-foreground no-underline">
            {t.next}
            <ArrowRightIcon aria-hidden="true" className="hidden lg:block" />
          </Link>
        </Button>
      }
    >
      <fieldset className="flex max-w-2xl flex-col gap-2.5">
        <legend className="sr-only">{t.kindTitle}</legend>
        {KINDS.map((kind) => (
          <label
            key={kind}
            className="grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-3 rounded-2xl border border-input bg-card p-4 has-checked:border-primary has-checked:bg-tint has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
          >
            <input
              type="radio"
              name="kind"
              value={kind}
              checked={draft.kind === kind}
              className="row-span-2 mt-1 size-5 shrink-0 accent-primary focus-visible:outline-none"
              onChange={() => updateDraft({ kind })}
            />
            <span className="font-semibold">{t.kind[kind]}</span>
            <span className="text-sm text-muted-on-tint">{t.kindHint[kind]}</span>
          </label>
        ))}
      </fieldset>
      {draft.kind === 'confidential' ? (
        <div className="flex max-w-2xl flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t.name}</Label>
            <Input
              id="name"
              autoComplete="off"
              value={draft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">{t.phone}</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="off"
              value={draft.phone}
              onChange={(event) => updateDraft({ phone: event.target.value })}
            />
          </div>
        </div>
      ) : null}
    </FlowShell>
  );
}
