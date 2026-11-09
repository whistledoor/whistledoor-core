// docs/report-app.md, section Whitelabel. The tenant sets one colour, and it has
// to stay readable as a button in both colour schemes.

type Rgb = readonly [number, number, number];

export interface PrimaryColors {
  primary: string;
  foreground: string;
}

export interface PrimaryTheme {
  light: PrimaryColors;
  dark: PrimaryColors;
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** WCAG AA for normal text. */
const MIN_TEXT_CONTRAST = 4.5;
/** WCAG AA for interface parts: buttons and the selected radio on a dark card. */
const MIN_SURFACE_CONTRAST = 3;

// The --primary-foreground tokens of styles.css as sRGB, kept in step by hand. The
// dark one is not black, so a mid grey can fall short with both.
const LIGHT_TEXT: Rgb = [0xff, 0xff, 0xff];
const DARK_TEXT: Rgb = [0x0f, 0x18, 0x28];
/** --card in dark mode. The page background is darker, so this is the harder case. */
const DARK_CARD: Rgb = [0x17, 0x23, 0x3a];

const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];
const ADJUST_STEPS = 100;

/** Reads `#rgb` or `#rrggbb`. Anything else is null. */
export function parseHexColor(value: string): Rgb | null {
  if (!HEX_COLOR.test(value)) {
    return null;
  }
  const digits = value.slice(1);
  const full = digits.length === 3 ? digits.replace(/./g, '$&$&') : digits;
  const number = parseInt(full, 16);
  return [(number >> 16) & 0xff, (number >> 8) & 0xff, number & 0xff];
}

function relativeLuminance(color: Rgb): number {
  const [red, green, blue] = color.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The WCAG contrast ratio, from 1 to 21. */
export function contrastRatio(first: Rgb, second: Rgb): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function bestText(color: Rgb): Rgb {
  return contrastRatio(color, LIGHT_TEXT) >= contrastRatio(color, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
}

function isReadable(color: Rgb): boolean {
  return contrastRatio(color, bestText(color)) >= MIN_TEXT_CONTRAST;
}

function mix(color: Rgb, target: Rgb, amount: number): Rgb {
  const channel = (index: 0 | 1 | 2): number =>
    Math.round(color[index] + (target[index] - color[index]) * amount);
  return [channel(0), channel(1), channel(2)];
}

/** The smallest move towards `target` that passes. Black and white both pass, so this always ends. */
function adjust(color: Rgb, target: Rgb, passes: (candidate: Rgb) => boolean): Rgb {
  for (let step = 0; step < ADJUST_STEPS; step++) {
    const candidate = mix(color, target, step / ADJUST_STEPS);
    if (passes(candidate)) {
      return candidate;
    }
  }
  return target;
}

function toHex(color: Rgb): string {
  return `#${color.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function toColors(primary: Rgb): PrimaryColors {
  return { primary: toHex(primary), foreground: toHex(bestText(primary)) };
}

/**
 * The colours to set for a tenant's primary colour, or null if it isn't a colour.
 *
 * Light mode darkens only if neither text colour reaches 4.5:1. Dark mode lightens,
 * as the lighter --primary in styles.css does, and also until the colour stands out
 * from the dark card, because it replaces that token: a navy button would disappear.
 */
export function createPrimaryTheme(color: string): PrimaryTheme | null {
  const parsed = parseHexColor(color);
  if (!parsed) {
    return null;
  }
  return {
    light: toColors(adjust(parsed, BLACK, isReadable)),
    dark: toColors(
      adjust(
        parsed,
        WHITE,
        (candidate) => isReadable(candidate) && contrastRatio(candidate, DARK_CARD) >= MIN_SURFACE_CONTRAST,
      ),
    ),
  };
}
