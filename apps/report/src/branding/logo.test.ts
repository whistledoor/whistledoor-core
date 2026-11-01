import { describe, expect, it } from 'vitest';
import { toSameOriginPath } from './logo';

describe('toSameOriginPath', () => {
  it.each([
    ['/api/logo', '/api/logo'],
    ['/logo.png', '/logo.png'],
    ['/api/logo?v=3', '/api/logo?v=3'],
    ['/api/logo#part', '/api/logo'],
    ['/a/../logo.png', '/logo.png'],
  ])('keeps %j', (value, path) => {
    expect(toSameOriginPath(value)).toBe(path);
  });

  it.each([
    '',
    'logo.png',
    './logo.png',
    '../logo.png',
    'https://example.com/logo.png',
    'http://example.com/logo.png',
    '//example.com/logo.png',
    '///example.com/logo.png',
    '/\\example.com/logo.png',
    '\\\\example.com/logo.png',
    '/\t/example.com/logo.png',
    '/\n/example.com/logo.png',
    '/\\\t/example.com/logo.png',
    ' /logo.png',
    'data:image/svg+xml,<svg/>',
    'blob:https://example.com/1',
    'javascript:alert(1)',
  ])('refuses %j', (value) => {
    expect(toSameOriginPath(value)).toBeNull();
  });
});
