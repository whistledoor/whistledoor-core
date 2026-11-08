import { cn } from '@/lib/utils';
import { TenantLogo } from './TenantLogo';

/** The tenant's logo, or a tile with the first letter of its name. Decorative: the name stands next to it. */
export function TenantMark({ name, logoUrl, className }: { name: string | undefined; logoUrl: string | undefined; className?: string }) {
  return (
    <TenantLogo
      url={logoUrl}
      fallback={
        <span
          aria-hidden="true"
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-tint font-bold text-tint-foreground',
            className,
          )}
        >
          {name?.trim().charAt(0).toLocaleUpperCase()}
        </span>
      }
    />
  );
}
