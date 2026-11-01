import { Outlet } from '@tanstack/react-router';
import { useI18n } from '../i18n/i18n';
import { useTenant } from '../api/useTenant';

export function Layout() {
  const { t, language, setLanguage } = useI18n();
  const { data: tenant } = useTenant();

  return (
    <div className="page">
      <header className="header">
        <span>
          {tenant ? `${tenant.name} · ` : ''}
          {t.channel}
        </span>
        <span className="languages">
          <button type="button" className="link" aria-pressed={language === 'de'} onClick={() => setLanguage('de')}>
            DE
          </button>
          <button type="button" className="link" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>
            EN
          </button>
        </span>
      </header>
      <main className="stack">
        <Outlet />
      </main>
      <footer className="footer">{t.providedBy}</footer>
    </div>
  );
}
