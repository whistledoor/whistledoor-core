// A real origin is not needed to resolve a path, and this one can't be confused with one.
const BASE = 'https://same-origin.invalid';

/**
 * The path to load a logo from, or null if it could leave this origin. The CSP
 * would block that too, but the page should not depend on it. The URL parser
 * decides, because `/\example.com` and `/<tab>/example.com` both resolve to
 * another host although they start with one slash.
 */
export function toSameOriginPath(value: string): string | null {
  if (!value.startsWith('/')) {
    return null;
  }
  try {
    const url = new URL(value, BASE);
    return url.origin === BASE ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
}
