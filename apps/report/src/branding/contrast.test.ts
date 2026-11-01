import { describe, expect, it } from 'vitest';
import { contrastRatio, createPrimaryTheme, parseHexColor } from './contrast';
import type { PrimaryColors } from './contrast';

const LIGHT_TEXT = '#f8f8f8';
const DARK_TEXT = '#0c1723';
const DARK_CARD = '#15191e';

function ratio(first: string, second: string): number {
  return contrastRatio(parseHexColor(first)!, parseHexColor(second)!);
}

function textContrast({ primary, foreground }: PrimaryColors): number {
  return ratio(primary, foreground);
}

function theme(color: string) {
  const created = createPrimaryTheme(color);
  if (!created) {
    throw new Error(`${color} should be accepted`);
  }
  return created;
}

describe('parseHexColor', () => {
  it('reads long and short forms in either case', () => {
    expect(parseHexColor('#0F766e')).toEqual([0x0f, 0x76, 0x6e]);
    expect(parseHexColor('#abc')).toEqual([0xaa, 0xbb, 0xcc]);
  });

  it.each([
    '',
    '#',
    '0f766e',
    '#12',
    '#1234',
    '#12345',
    '#1234567',
    '#12345678',
    '#ggg',
    '#fff\n',
    ' #ffffff',
    'red',
    'rgb(0, 0, 0)',
    'var(--primary)',
    '#fff; background: url(//evil.example)',
  ])('refuses %j', (value) => {
    expect(parseHexColor(value)).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('gives the WCAG reference values', () => {
    expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(ratio('#ffffff', '#ffffff')).toBe(1);
    expect(ratio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('does not depend on the order', () => {
    expect(ratio('#0f766e', '#ffffff')).toBe(ratio('#ffffff', '#0f766e'));
  });
});

describe('createPrimaryTheme', () => {
  it('ignores an invalid colour', () => {
    expect(createPrimaryTheme('red')).toBeNull();
    expect(createPrimaryTheme('#12')).toBeNull();
  });

  it('keeps a dark colour in light mode, with light text', () => {
    expect(theme('#0F766E').light).toEqual({ primary: '#0f766e', foreground: LIGHT_TEXT });
  });

  it('gives a very light yellow dark text and leaves it unchanged', () => {
    const { light, dark } = theme('#fffde0');
    expect(light).toEqual({ primary: '#fffde0', foreground: DARK_TEXT });
    expect(dark).toEqual({ primary: '#fffde0', foreground: DARK_TEXT });
  });

  it('expands the short form', () => {
    expect(theme('#fe0').light.primary).toBe('#ffee00');
  });

  describe('a mid grey, where neither text colour reaches 4.5:1', () => {
    it('really is that case', () => {
      expect(ratio('#777777', LIGHT_TEXT)).toBeLessThan(4.5);
      expect(ratio('#777777', DARK_TEXT)).toBeLessThan(4.5);
    });

    it('darkens in light mode, under light text', () => {
      const { light } = theme('#777777');
      expect(light.foreground).toBe(LIGHT_TEXT);
      expect(light.primary).not.toBe('#777777');
      expect(ratio(light.primary, '#ffffff')).toBeGreaterThan(ratio('#777777', '#ffffff'));
      expect(textContrast(light)).toBeGreaterThanOrEqual(4.5);
    });

    it('lightens in dark mode, under dark text', () => {
      const { dark } = theme('#777777');
      expect(dark.foreground).toBe(DARK_TEXT);
      expect(ratio(dark.primary, DARK_CARD)).toBeGreaterThan(ratio('#777777', DARK_CARD));
      expect(textContrast(dark)).toBeGreaterThanOrEqual(4.5);
    });

    it('moves no further than it has to', () => {
      const { light, dark } = theme('#777777');
      expect(textContrast(light)).toBeLessThan(4.8);
      expect(textContrast(dark)).toBeLessThan(4.8);
    });
  });

  describe('dark mode', () => {
    it('lifts a navy off the dark card', () => {
      const { dark } = theme('#15466a');
      expect(dark.primary).not.toBe('#15466a');
      expect(ratio(dark.primary, DARK_CARD)).toBeGreaterThanOrEqual(3);
      expect(textContrast(dark)).toBeGreaterThanOrEqual(4.5);
    });

    it('lifts black as well', () => {
      expect(ratio(theme('#000000').dark.primary, DARK_CARD)).toBeGreaterThanOrEqual(3);
    });

    it('leaves a colour alone that already works', () => {
      expect(theme('#7db4e4').dark).toEqual({ primary: '#7db4e4', foreground: DARK_TEXT });
    });
  });

  it('reaches 4.5:1 in both modes across the whole colour cube', () => {
    const levels = [0, 0x33, 0x66, 0x77, 0x88, 0x99, 0xcc, 0xff];
    const hex = (value: number): string => value.toString(16).padStart(2, '0');
    for (const red of levels) {
      for (const green of levels) {
        for (const blue of levels) {
          const { light, dark } = theme(`#${hex(red)}${hex(green)}${hex(blue)}`);
          expect(textContrast(light)).toBeGreaterThanOrEqual(4.5);
          expect(textContrast(dark)).toBeGreaterThanOrEqual(4.5);
          expect(ratio(dark.primary, DARK_CARD)).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});
