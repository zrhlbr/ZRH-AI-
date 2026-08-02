import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { zrhIcons } from '../design-system/icons';
import { BrandMark } from '../design-system/BrandMark';
import { brand, themes, themeOrder } from '../design-system/theme';
import type { ZrhThemeId } from '../design-system/theme';
import { motionTokens } from '../design-system/animations';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ZButton, ZToastHost } from './ui';

/**
 * AppShell — 认证后的统一框架：左侧导航 + 顶栏 + 内容区。
 * 菜单按用户权限码过滤；移动端抽屉式侧栏（手机优先）。
 */
export function AppShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { themeId, setTheme } = useThemeStore();
  const { profile, clear, refreshToken } = useAuthStore();

  const menuItems = [
    { to: '/home', key: 'menu:home', label: t('nav.home'), icon: zrhIcons.home, end: true },
    { to: '/chat', key: 'menu:chat', label: t('nav.chat'), icon: zrhIcons.ai },
    { to: '/knowledge', key: 'menu:knowledge', label: t('nav.knowledge'), icon: zrhIcons.knowledge },
    { to: '/rag', key: 'menu:rag', label: t('nav.rag'), icon: zrhIcons.rag },
    { to: '/agents', key: 'menu:agents', label: t('nav.agents'), icon: zrhIcons.agents },
    { to: '/tools', key: 'menu:tools', label: t('nav.tools'), icon: zrhIcons.tools },
    { to: '/mcp', key: 'menu:mcp', label: t('nav.mcp'), icon: zrhIcons.mcp },
    { to: '/workflows', key: 'menu:workflows', label: t('nav.workflows'), icon: zrhIcons.workflows },
    { to: '/business', key: 'menu:business', label: t('nav.business'), icon: zrhIcons.business },
    { to: '/ai/models', key: 'menu:ai-models', label: t('nav.models'), icon: zrhIcons.cpu },
    { to: '/account', key: 'menu:account', label: t('nav.account'), icon: zrhIcons.user },
    { to: '/developer', key: 'menu:developer', label: t('nav.developer'), icon: zrhIcons.tools },
    { to: '/admin', key: 'menu:admin', label: t('nav.admin'), icon: zrhIcons.shield },
    { to: '/superadmin', key: 'menu:superadmin', label: t('nav.superadmin'), icon: zrhIcons.database },
    { to: '/status', key: 'menu:status', label: t('nav.status'), icon: zrhIcons.dashboard },
  ].filter((item) => profile?.permissions.includes(item.key));

  const logout = async () => {
    if (refreshToken) {
      try {
        const { api } = await import('../api/client');
        await api.logout(refreshToken);
      } catch {
        // 忽略网络异常，本地状态必须清理
      }
    }
    clear();
    navigate('/login', { replace: true });
  };

  const nav = (
    <nav className="flex flex-col gap-1">
      {menuItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setDrawerOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm transition-colors ${
              isActive
                ? 'bg-zrh-accent/10 text-zrh-accent font-semibold'
                : 'text-zrh-text-dim hover:bg-zrh-surface-raised hover:text-zrh-text'
            }`
          }
        >
          <item.icon className="h-4 w-4" aria-hidden />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-full bg-zrh-bg text-zrh-text">
      {/* 桌面侧栏 */}
      <aside className="zrh-shell-aside hidden w-56 shrink-0 flex-col border-r border-zrh-border bg-zrh-surface lg:flex">
        <div className="flex items-center gap-2.5 border-b border-zrh-border px-5 py-4">
          <BrandMark size={40} className="h-10 w-10 shrink-0 rounded-zrh-lg shadow-zrh-glow" />
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-brand text-zrh-accent">{brand.name}</p>
            <p className="mt-0.5 truncate text-caption text-zrh-text-dim">{brand.groupZh}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{nav}</div>
        <div className="border-t border-zrh-border px-5 py-3 text-caption text-zrh-text-dim">
          <NavLink to="/release-notes" className="block text-zrh-accent hover:underline">
            {t('releaseNotes.link')} · v{brand.appVersion}
          </NavLink>
          <p className="mt-1">{brand.copyright}</p>
        </div>
      </aside>

      {/* 移动端抽屉 */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-zrh-text/40 backdrop-blur-sm lg:hidden"
            onClick={() => setDrawerOpen(false)}
          >
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ duration: motionTokens.duration.base, ease: motionTokens.ease.out }}
              className="zrh-shell-aside flex h-full w-60 flex-col bg-zrh-surface shadow-zrh-raised"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zrh-border px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <BrandMark size={36} className="h-9 w-9 shrink-0 rounded-zrh-md shadow-zrh-glow" />
                  <div>
                    <span className="block text-sm font-bold tracking-brand text-zrh-accent">
                      {brand.name}
                    </span>
                    <span className="block text-caption text-zrh-text-dim">{brand.groupZh}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setDrawerOpen(false)} aria-label={t('common.close')}>
                  <X className="h-5 w-5 text-zrh-text-dim" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">{nav}</div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主区域 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="zrh-shell-header sticky top-0 z-30 border-b border-zrh-border bg-zrh-bg/85 backdrop-blur">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-zrh-md p-1.5 text-zrh-text-dim hover:bg-zrh-surface-raised hover:text-zrh-text lg:hidden"
                onClick={() => setDrawerOpen(true)}
                aria-label={t('nav.menu')}
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="flex items-center gap-1.5 text-sm font-bold tracking-brand text-zrh-accent lg:hidden">
                <BrandMark size={24} className="h-6 w-6 rounded-zrh-sm" />
                {brand.name}
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {/* 主题切换 */}
              <div className="hidden items-center gap-1.5 sm:flex" aria-label={t('theme.label')}>
                {themeOrder.map((id: ZrhThemeId) => {
                  const theme = themes[id];
                  const swatch =
                    theme.scheme === 'light' ? theme.colors.bg : theme.colors.accent;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      title={t(theme.labelKey)}
                      onClick={() => setTheme(theme.id)}
                      className={`h-4 w-4 rounded-full border transition-transform ${
                        themeId === theme.id
                          ? 'scale-125 border-zrh-accent ring-2 ring-zrh-accent/30'
                          : 'border-zrh-border'
                      }`}
                      style={{ backgroundColor: swatch }}
                    />
                  );
                })}
              </div>
              <LanguageSwitcher />
              {/* 用户菜单 */}
              <div className="flex items-center gap-2 border-l border-zrh-border pl-2 sm:pl-3">
                <button
                  type="button"
                  className="hidden text-xs text-zrh-text-dim hover:text-zrh-accent md:inline"
                  onClick={() => navigate('/account')}
                >
                  {profile?.displayName ?? profile?.username}
                </button>
                <ZButton variant="ghost" size="sm" onClick={() => void logout()}>
                  {t('auth.logout')}
                </ZButton>
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1">
          <div key={location.pathname} className="zrh-page-enter min-h-full">
            <Outlet />
          </div>
        </main>
      </div>
      <ZToastHost />
    </div>
  );
}
