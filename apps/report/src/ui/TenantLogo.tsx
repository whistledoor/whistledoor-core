import { useState } from 'react';
import { toSameOriginPath } from '../branding/logo';

/** Decorative: the company name stands next to it. */
export function TenantLogo({ url }: { url: string | undefined }) {
  const [failed, setFailed] = useState(false);
  const path = url === undefined ? null : toSameOriginPath(url);

  if (!path || failed) {
    return null;
  }
  return (
    <img
      src={path}
      alt=""
      className="h-8 w-auto max-w-24 shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  );
}
