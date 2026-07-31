import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { zrhIcons } from '../design-system/icons';
import { brand, themes } from '../design-system/theme';
import type { ZrhTheme } from '../design-system/theme';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ZButton } from './ui';

/**
 * AppShell — 认证后的统一框架：左侧导航 + 顶栏 + 内容区。
 * 菜单按用户权限码过滤；移动端抽屉式侧栏（手机优先）。
 */
export function AppShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { themeId, setTheme } = useThemeStore();
  const { profile, clear, refreshToken } = useAuthStore();

  const BrandIcon = zrhIcons.brand;

  const menuItems = [
    { to: '/', key: 'menu:home', label: t('nav.home'), icon: zrhIcons.home, end: true },
    { to: '/chat', key: 'menu:chat', label: t('nav.chat'), icon: zrhIcons.ai },
    { to: '/knowledge', key: 'menu:knowledge', label: t('nav.knowledge'), icon: zrhIcons.knowledge },
    { to: '/rag', key: 'menu:rag', label: t('nav.rag'), icon: zrhIcons.rag },
    { to: '/agents', key: 'menu:agents', label: t('nav.agents'), icon: zrhIcons.agents },
    { to: '/tools', key: 'menu:tools', label: t('nav.tools'), icon: zrhIcons.tools },
    { to: '/mcp', key: 'menu:mcp', label: t('nav.mcp'), icon: zrhIcons.mcp },
    { to: '/ai/models', key: 'menu:ai-models', label: t('nav.models'), icon: zrhIcons.cpu },
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
      <aside className="hidden w-56 shrink-0 flex-col border-r border-zrh-border bg-zrh-surface lg:flex">
        <div className="flex items-center gap-2.5 border-b border-zrh-border px-5 py-4">
          <BrandIcon className="h-5 w-5 text-zrh-accent" aria-hidden />
          <div>
            <p className="text-sm font-bold tracking-widest text-zrh-accent">{brand.logo}</p>
            <p className="text-[10px] text-zrh-text-dim">{brand.subtitle}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{nav}</div>
        <p className="border-t border-zrh-border px-5 py-3 text-[10px] text-zrh-text-dim">
          {brand.copyright}
        </p>
      </aside>

      {/* 移动端抽屉 */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setDrawerOpen(false)}
          >
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ duration: 0.2 }}
              className="flex h-full w-60 flex-col bg-zrh-surface"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zrh-border px-5 py-4">
                <span className="text-sm font-bold tracking-widest text-zrh-accent">
                  {brand.logo}
                </span>
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
        <header className="sticky top-0 z-30 border-b border-zrh-border bg-zrh-bg/85 backdrop-blur">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md p-1.5 text-zrh-text-dim hover:text-zrh-text lg:hidden"
                onClick={() => setDrawerOpen(true)}
                aria-label={t('nav.menu')}
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="text-sm font-bold tracking-widest text-zrh-accent lg:hidden">
                {brand.logo}
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {/* 主题切换 */}
              <div className="hidden items-center gap-1 sm:flex" aria-label={t('theme.label')}>
                {Object.values(themes).map((theme: ZrhTheme) => (
                  <button
                    key={theme.id}
                    type="button"
                    title={t(theme.labelKey)}
                    onClick={() => setTheme(theme.id)}
                    className={`h-4 w-4 rounded-full border transition-transform ${
                      themeId === theme.id ? 'scale-125 border-zrh-accent' : 'border-zrh-border'
                    }`}
                    style={{ backgroundColor: theme.colors.accent }}
                  />
                ))}
              </div>
              <LanguageSwitcher />
              {/* 用户菜单 */}
              <div className="flex items-center gap-2 border-l border-zrh-border pl-2 sm:pl-3">
                <span className="hidden text-xs text-zrh-text-dim md:inline">
                  {profile?.displayName ?? profile?.username}
                </span>
                <ZButton variant="ghost" size="sm" onClick={() => void logout()}>
                  {t('auth.logout')}
                </ZButton>
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
