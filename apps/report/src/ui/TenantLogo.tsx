import { useState } from 'react';
import type { ReactNode } from 'react';
import { toSameOriginPath } from '../branding/logo';

/** Decorative: the company name stands next to it. Shows `fallback` without a usable logo. */
export function TenantLogo({ url, fallback = null }: { url: string | undefined; fallback?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const path = url === undefined ? null : toSameOriginPath(url);

  if (!path || failed) {
    return fallback;
  }
  return (
    <img
      src={path}
      alt=""
      className="h-9 w-auto max-w-24 shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  );
}
