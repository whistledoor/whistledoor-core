import type { Language } from '@whistledoor/api-contract';

/** The browser's own locale for this language, so `en` can mean en-GB: dates read as the reporter is used to. */
export function localeFor(language: Language, preferred: readonly string[]): string {
  return preferred.find((tag) => tag.toLowerCase().split('-')[0] === language) ?? language;
}

export function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

const KILOBYTE = 1000;
const MEGABYTE = 1000 * 1000;

/** `1,2 MB` in German, `1.2 MB` in English. */
export function formatSize(bytes: number, locale: string): string {
  const [value, unit] = bytes >= MEGABYTE ? [bytes / MEGABYTE, 'megabyte'] : [Math.max(bytes / KILOBYTE, 1), 'kilobyte'];
  return new Intl.NumberFormat(locale, { style: 'unit', unit, maximumFractionDigits: 1 }).format(value);
}

/** Up to two initials for an avatar: "Anna Berger" gives "AB". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toLocaleUpperCase())
    .join('');
}
