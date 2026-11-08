import { cn } from '@/lib/utils';
import { useTenant } from '../api/useTenant';
import { useI18n } from '../i18n/i18n';
import { Preferences } from './Preferences';
import { TenantMark } from './TenantMark';

/** Logo, company, "Meldestelle nach HSchG", language and theme. */
export function AppHeader({ plain = false }: { plain?: boolean }) {
  const { t } = useI18n();
  const { data: tenant } = useTenant();
  return (
    <header
      className={cn(
        'flex items-center gap-2.5 py-3 pr-3 pl-5 print:hidden lg:px-12',
        plain ? 'lg:py-3.5' : 'border-b bg-card',
      )}
    >
      <TenantMark name={tenant?.name} logoUrl={tenant?.branding?.logoUrl} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-semibold lg:text-[15px]">{tenant?.name}</p>
        <p className="truncate text-xs text-muted-foreground lg:text-[13px]">{t.channel}</p>
      </div>
      <Preferences />
    </header>
  );
}
