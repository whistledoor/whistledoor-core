import { useLayoutEffect } from 'react';
import { createPrimaryTheme } from './contrast';

const DARK_SCHEME = '(prefers-color-scheme: dark)';

/**
 * Sets --primary and --primary-foreground on the root element. `style-src 'self'`
 * allows this and nothing like it: no `<style>` tag, no `style` attribute. Inline
 * values beat the dark-mode rule in styles.css, so the scheme is followed here.
 * A layout effect, so the default colour never paints first.
 */
export function useBrandColor(color: string | undefined): void {
  useLayoutEffect(() => {
    const theme = color === undefined ? null : createPrimaryTheme(color);
    if (!theme) {
      return undefined;
    }
    const { style } = document.documentElement;
    const scheme = window.matchMedia(DARK_SCHEME);
    const apply = (): void => {
      const { primary, foreground } = scheme.matches ? theme.dark : theme.light;
      style.setProperty('--primary', primary);
      style.setProperty('--primary-foreground', foreground);
    };
    apply();
    scheme.addEventListener('change', apply);
    return () => {
      scheme.removeEventListener('change', apply);
      style.removeProperty('--primary');
      style.removeProperty('--primary-foreground');
    };
  }, [color]);
}
