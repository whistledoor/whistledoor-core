import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useSession } from '../case/session';
import type { ReportKind } from '../case/categories';
import { useI18n } from '../i18n/i18n';
import { Screen } from '../ui/Screen';

const KINDS: readonly ReportKind[] = ['anonymous', 'confidential'];

export function Kind() {
  const { t } = useI18n();
  const { draft, updateDraft } = useSession();

  return (
    <Screen
      title={t.kindTitle}
      meta={
        <>
          <Link className="underline" to="/">
            {t.back}
          </Link>{' '}
          · {t.stepOf(1, 4)}
        </>
      }
    >
      <RadioGroup value={draft.kind} onValueChange={(kind) => updateDraft({ kind: kind as ReportKind })}>
        {KINDS.map((kind) => (
          <Label
            key={kind}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-foreground"
          >
            <RadioGroupItem value={kind} className="mt-0.5" />
            <span>
              <span className="block font-medium">{t.kind[kind]}</span>
              <span className="block text-sm text-muted-foreground">{t.kindHint[kind]}</span>
            </span>
          </Label>
        ))}
      </RadioGroup>
      {draft.kind === 'confidential' ? (
        <>
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
        </>
      ) : null}
      <Button asChild>
        <Link to="/write">{t.next}</Link>
      </Button>
    </Screen>
  );
}
