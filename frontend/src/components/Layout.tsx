import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Layout() {
  const { t } = useTranslation();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm transition-colors ${
      isActive ? 'text-zrh-gold font-semibold' : 'text-zrh-text-dim hover:text-zrh-text'
    }`;

  return (
    <div className="flex min-h-full flex-col bg-zrh-bg text-zrh-text">
      <header className="sticky top-0 z-10 border-b border-zrh-border bg-zrh-bg/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-zrh-gold" aria-hidden />
            <span className="text-lg font-bold tracking-wide text-zrh-gold">
              {t('app.name')}
            </span>
            <nav className="ml-4 flex items-center gap-1">
              <NavLink to="/" end className={linkClass}>
                {t('nav.home')}
              </NavLink>
              <NavLink to="/status" className={linkClass}>
                {t('nav.status')}
              </NavLink>
            </nav>
          </div>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-zrh-border px-4 py-3 text-center text-xs text-zrh-text-dim">
        {t('app.name')} · {t('home.stage')}
      </footer>
    </div>
  );
}
