import { useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { zrhIcons } from '../design-system/icons';
import { BrandMark } from '../design-system/BrandMark';
import { brand, themes, themeOrder } from '../design-system/theme';
import type { ZrhThemeId } from '../design-system/theme';
import { motionTokens } from '../design-system/animations';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ZButton, ZToastHost } from './ui';

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  match?: 'exact' | 'account' | 'settings';
};

function navActive(item: NavItem, pathname: string, search: string, isActive: boolean): boolean {
  if (item.match === 'settings') {
    return pathname === '/account' && search.includes('tab=security');
  }
  if (item.match === 'account') {
    return pathname === '/account' && !search.includes('tab=security');
  }
  return isActive;
}

/**
 * AppShell — 用户端简洁导航；企业管理入口仅 ADMIN / SUPER_ADMIN。
 */
export function AppShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { themeId, setTheme } = useThemeStore();
  const { profile, clear, refreshToken, hasPermission } = useAuthStore();

  const role = profile?.role ?? '';
  const isEnterpriseAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const userItems: NavItem[] = [
    { to: '/home', label: t('nav.home'), icon: zrhIcons.home, end: true },
    { to: '/chat', label: t('nav.chat'), icon: zrhIcons.ai },
  ];
  if (hasPermission('menu:knowledge')) {
    userItems.push({ to: '/knowledge', label: t('nav.knowledge'), icon: zrhIcons.knowledge });
  }
  userItems.push(
    { to: '/account', label: t('nav.me'), icon: zrhIcons.user, match: 'account' },
    { to: '/account?tab=security', label: t('nav.settings'), icon: SettingsIcon, match: 'settings' },
  );

  const enterpriseItems: NavItem[] = [];
  if (isEnterpriseAdmin) {
    const adminNav: Array<NavItem & { key: string }> = [
      { to: '/rag', key: 'menu:rag', label: t('nav.rag'), icon: zrhIcons.rag },
      { to: '/agents', key: 'menu:agents', label: t('nav.agents'), icon: zrhIcons.agents },
      { to: '/tools', key: 'menu:tools', label: t('nav.tools'), icon: zrhIcons.tools },
      { to: '/mcp', key: 'menu:mcp', label: t('nav.mcp'), icon: zrhIcons.mcp },
      { to: '/workflows', key: 'menu:workflows', label: t('nav.workflows'), icon: zrhIcons.workflows },
      { to: '/business', key: 'menu:business', label: t('nav.business'), icon: zrhIcons.business },
      { to: '/ai/models', key: 'menu:ai-models', label: t('nav.models'), icon: zrhIcons.cpu },
      { to: '/developer', key: 'menu:developer', label: t('nav.developer'), icon: zrhIcons.tools },
      { to: '/status', key: 'menu:status', label: t('nav.status'), icon: zrhIcons.dashboard },
      { to: '/admin', key: 'menu:admin', label: t('nav.admin'), icon: zrhIcons.shield },
      { to: '/superadmin', key: 'menu:superadmin', label: t('nav.superadmin'), icon: zrhIcons.database },
    ];
    for (const item of adminNav) {
      if (profile?.permissions.includes(item.key)) {
        enterpriseItems.push({ to: item.to, label: item.label, icon: item.icon });
      }
    }
  }

  const logout = async () => {
    if (refreshToken) {
      try {
        const { api } = await import('../api/client');
        await api.logout(refreshToken);
      } catch {
        // ignore
      }
    }
    clear();
    navigate('/login', { replace: true });
  };

  const renderNav = (items: NavItem[]) =>
    items.map((item) => (
      <NavLink
        key={`${item.to}-${item.match ?? 'path'}`}
        to={item.to}
        end={item.end}
        onClick={() => setDrawerOpen(false)}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
            navActive(item, location.pathname, location.search, isActive)
              ? 'bg-zrh-accent/10 font-semibold text-zrh-accent'
              : 'text-zrh-text-dim hover:bg-zrh-surface-raised hover:text-zrh-text'
          }`
        }
      >
        <item.icon className="h-4 w-4 shrink-0" aria-hidden />
        {item.label}
      </NavLink>
    ));

  const nav = (
    <nav className="flex flex-col gap-1">
      {renderNav(userItems)}
      {enterpriseItems.length > 0 && (
        <>
          <p className="mb-1 mt-4 px-3.5 text-[10px] font-semibold uppercase tracking-widest text-zrh-text-dim/70">
            {t('nav.enterprise')}
          </p>
          {renderNav(enterpriseItems)}
        </>
      )}
    </nav>
  );

  return (
    <div className="zrh-app-shell flex min-h-full w-full max-w-[100vw] overflow-x-hidden bg-zrh-bg text-zrh-text">
      <aside className="zrh-shell-aside hidden w-56 shrink-0 flex-col border-r border-zrh-border bg-zrh-surface lg:flex">
        <div className="flex items-center gap-2.5 border-b border-zrh-border px-4 py-3.5">
          <BrandMark size={36} className="h-9 w-9 shrink-0 rounded-zrh-lg shadow-zrh-glow" />
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-brand text-zrh-accent">{brand.name}</p>
            <p className="mt-0.5 truncate text-caption text-zrh-text-dim">{t('app.tagline')}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">{nav}</div>
        <div className="border-t border-zrh-border p-3">
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-zrh-text-dim transition-colors hover:bg-zrh-surface-raised hover:text-zrh-text"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {t('auth.logout')}
          </button>
          <NavLink to="/release-notes" className="mt-2 block px-3.5 text-caption text-zrh-accent hover:underline">
            {t('releaseNotes.link')} · v{brand.appVersion}
          </NavLink>
        </div>
      </aside>

      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 max-w-[100vw] overflow-hidden bg-zrh-text/40 backdrop-blur-sm lg:hidden"
            onClick={() => setDrawerOpen(false)}
          >
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: motionTokens.duration.base, ease: motionTokens.ease.out }}
              className="zrh-shell-aside flex h-full w-[min(16.5rem,85vw)] max-w-full flex-col overflow-x-hidden bg-zrh-surface shadow-zrh-raised"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zrh-border px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <BrandMark size={32} className="h-8 w-8 shrink-0 rounded-zrh-md shadow-zrh-glow" />
                  <span className="truncate text-sm font-bold tracking-brand text-zrh-accent">{brand.name}</span>
                </div>
                <button type="button" onClick={() => setDrawerOpen(false)} aria-label={t('common.close')} className="rounded-lg p-1.5">
                  <X className="h-5 w-5 text-zrh-text-dim" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">{nav}</div>
              <div className="border-t border-zrh-border p-3">
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    void logout();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-zrh-text-dim hover:bg-zrh-surface-raised hover:text-zrh-text"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  {t('auth.logout')}
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
        <header className="zrh-shell-header sticky top-0 z-30 border-b border-zrh-border bg-zrh-bg/90 backdrop-blur">
          <div className="zrh-shell-header-inner grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-2 sm:px-4">
            <div className="flex items-center justify-start">
              <button
                type="button"
                className="rounded-zrh-md p-1.5 text-zrh-text-dim hover:bg-zrh-surface-raised hover:text-zrh-text lg:hidden"
                onClick={() => setDrawerOpen(true)}
                aria-label={t('nav.menu')}
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="ml-1 hidden truncate text-sm font-semibold text-zrh-text-dim lg:inline">
                {profile?.displayName ?? profile?.username}
              </span>
            </div>

            <div className="flex items-center justify-center gap-1.5 lg:hidden">
              <BrandMark size={22} className="h-[22px] w-[22px] rounded-zrh-sm" />
              <span className="text-sm font-bold tracking-brand text-zrh-accent">{brand.name}</span>
            </div>

            <div className="flex items-center justify-end gap-1 sm:gap-1.5">
              <div className="hidden items-center gap-1 sm:flex" aria-label={t('theme.label')}>
                {themeOrder.map((id: ZrhThemeId) => {
                  const theme = themes[id];
                  const swatch = theme.scheme === 'light' ? theme.colors.bg : theme.colors.accent;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      title={t(theme.labelKey)}
                      onClick={() => setTheme(theme.id)}
                      className={`h-3.5 w-3.5 rounded-full border transition-transform ${
                        themeId === theme.id
                          ? 'scale-125 border-zrh-accent ring-2 ring-zrh-accent/30'
                          : 'border-zrh-border'
                      }`}
                      style={{ backgroundColor: swatch }}
                    />
                  );
                })}
              </div>
              <LanguageSwitcher compact />
              <ZButton variant="ghost" size="sm" className="min-h-8 px-2 text-xs" onClick={() => void logout()}>
                {t('auth.logout')}
              </ZButton>
            </div>
          </div>
        </header>

        <main className="min-w-0 max-w-full flex-1 overflow-x-hidden">
          <div key={location.pathname + location.search} className="zrh-page-enter min-h-full max-w-full overflow-x-hidden">
            <Outlet />
          </div>
        </main>
      </div>
      <ZToastHost />
    </div>
  );
}
