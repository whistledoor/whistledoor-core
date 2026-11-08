import { useLayoutEffect } from 'react';
import type { Theme } from '../theme/theme';
import { createPrimaryTheme } from './contrast';

/**
 * Sets --primary and --primary-foreground on the root element. `style-src 'self'`
 * allows this and nothing like it: no `<style>` tag, no `style` attribute. Inline
 * values beat the dark-mode rules in styles.css, so the theme is followed here.
 * A layout effect, so the default colour never paints first.
 */
export function useBrandColor(color: string | undefined, theme: Theme): void {
  useLayoutEffect(() => {
    const colors = color === undefined ? null : createPrimaryTheme(color);
    if (!colors) {
      return undefined;
    }
    const { style } = document.documentElement;
    const { primary, foreground } = colors[theme];
    style.setProperty('--primary', primary);
    style.setProperty('--primary-foreground', foreground);
    return () => {
      style.removeProperty('--primary');
      style.removeProperty('--primary-foreground');
    };
  }, [color, theme]);
}
