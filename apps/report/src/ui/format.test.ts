import { describe, expect, it } from 'vitest';
import { formatDate, formatSize, initials, localeFor } from './format';

describe('localeFor', () => {
  it('takes the browser tag that matches the language', () => {
    expect(localeFor('en', ['de-AT', 'en-GB'])).toBe('en-GB');
    expect(localeFor('de', ['de-AT', 'en-GB'])).toBe('de-AT');
  });

  it('falls back to the language', () => {
    expect(localeFor('de', ['en-US'])).toBe('de');
    expect(localeFor('en', [])).toBe('en');
  });
});

describe('formatDate', () => {
  const date = new Date(2026, 10, 15);

  it('writes the month out', () => {
    expect(formatDate(date, 'de-AT')).toBe('15. November 2026');
    expect(formatDate(date, 'en-GB')).toBe('15 November 2026');
    expect(formatDate(date, 'en-US')).toBe('November 15, 2026');
  });
});

describe('formatSize', () => {
  it('uses the locale', () => {
    expect(formatSize(1_234_567, 'de')).toBe('1,2 MB');
    expect(formatSize(1_234_567, 'en')).toBe('1.2 MB');
  });

  it('shows small files in kB, at least 1', () => {
    expect(formatSize(45_300, 'en')).toBe('45.3 kB');
    expect(formatSize(12, 'en')).toBe('1 kB');
  });
});

describe('initials', () => {
  it('takes the first letters of two words', () => {
    expect(initials('Anna Berger')).toBe('AB');
    expect(initials('  peter  huber ')).toBe('PH');
    expect(initials('Maria Anna Gruber')).toBe('MA');
    expect(initials('Compliance')).toBe('C');
  });
});
