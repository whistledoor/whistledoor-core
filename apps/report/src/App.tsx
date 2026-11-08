import { RouterProvider } from '@tanstack/react-router';
import { useTenant } from './api/useTenant';
import { useBrandColor } from './branding/useBrandColor';
import { SessionProvider } from './case/session';
import { I18nProvider } from './i18n/i18n';
import { router } from './router';
import { useTheme } from './theme/theme';

export function App() {
  const { data: tenant } = useTenant();
  useBrandColor(tenant?.branding?.primaryColor, useTheme());
  return (
    <I18nProvider tenantDefault={tenant?.defaultLanguage}>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </I18nProvider>
  );
}
