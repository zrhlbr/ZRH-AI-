import { useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, LogOut, Settings as SettingsIcon, MoreHorizontal, MessagesSquare, Star } from 'lucide-react';
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
};

/**
 * UX V4.0 用户端壳层 —— 用户菜单固定 7 项（首页 / AI 对话 / 我的会话 / 收藏 /
 * 我的 / 设置 / 退出登录），企业入口在用户端不存在（非 display:none、非权限判断）。
 * ADMIN / SUPER_ADMIN 额外保留知识平台与管理控制台入口，后台功能不变。
 */
export function AppShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { themeId, setTheme } = useThemeStore();
  const { profile, clear, refreshToken } = useAuthStore();

  const role = profile?.role ?? '';
  const showAdminConsole = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const showSuperConsole = role === 'SUPER_ADMIN';

  /** 认证壳内禁止 body 整页滚动，仅 Content 滚动 */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /** 消费者菜单（所有角色共有） */
  const consumerItems: NavItem[] = [
    { to: '/home', label: t('nav.home'), icon: zrhIcons.home, end: true },
    { to: '/chat', label: t('nav.chat'), icon: zrhIcons.ai },
    { to: '/conversations', label: t('nav.conversations'), icon: MessagesSquare },
    { to: '/favorites', label: t('nav.favorites'), icon: Star },
    { to: '/me', label: t('nav.me'), icon: zrhIcons.user },
    { to: '/settings', label: t('nav.settings'), icon: SettingsIcon },
  ];

  /** 管理角色在消费者菜单基础上追加知识平台入口（其余企业功能在控制台内） */
  const drawerItems: NavItem[] = showAdminConsole
    ? [
        ...consumerItems.slice(0, 4),
        { to: '/knowledge', label: t('nav.knowledge'), icon: zrhIcons.knowledge },
        ...consumerItems.slice(4),
      ]
    : consumerItems;

  /** 底栏主入口：首页 / AI 对话 / 我的会话 / 我的 */
  const bottomItems: NavItem[] = consumerItems.slice(0, 3).concat(consumerItems[4]);

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

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium leading-normal transition-colors ${
      isActive
        ? 'bg-zrh-accent/10 font-semibold text-zrh-accent'
        : 'text-zrh-text-dim hover:bg-zrh-surface-raised hover:text-zrh-text'
    }`;

  const nav = (
    <nav className="flex flex-col gap-1" aria-label={t('nav.menu')}>
      {drawerItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setDrawerOpen(false)}
          className={linkClass}
        >
          <item.icon className="h-4 w-4 shrink-0" aria-hidden />
          {item.label}
        </NavLink>
      ))}

      {(showAdminConsole || showSuperConsole) && (
        <>
          <div className="my-2 border-t border-zrh-border/70" aria-hidden />
          <p className="mb-1 px-3.5 text-[10px] font-semibold uppercase tracking-widest text-zrh-text-dim/70">
            {t('nav.enterprise')}
          </p>
          {showAdminConsole && (
            <NavLink to="/admin" onClick={() => setDrawerOpen(false)} className={linkClass}>
              <zrhIcons.shield className="h-4 w-4 shrink-0" aria-hidden />
              {t('nav.admin')}
            </NavLink>
          )}
          {showSuperConsole && (
            <NavLink to="/superadmin" onClick={() => setDrawerOpen(false)} className={linkClass}>
              <zrhIcons.database className="h-4 w-4 shrink-0" aria-hidden />
              {t('nav.superadmin')}
            </NavLink>
          )}
        </>
      )}
    </nav>
  );

  const bottomActive = (to: string, end?: boolean) => {
    if (end) return location.pathname === to;
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  return (
    <div className="zrh-app-shell flex h-dvh max-h-dvh w-full max-w-[100vw] overflow-hidden bg-zrh-bg text-zrh-text">
      {/* 桌面侧栏 */}
      <aside className="zrh-shell-aside hidden w-56 shrink-0 flex-col border-r border-zrh-border bg-zrh-surface lg:flex">
        <div className="flex items-center gap-2.5 border-b border-zrh-border px-4 py-3">
          <BrandMark size={36} className="h-9 w-9 shrink-0 rounded-zrh-lg shadow-zrh-glow" />
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-brand text-zrh-accent">{brand.name}</p>
            <p className="mt-0.5 truncate text-caption font-normal leading-normal text-zrh-text-dim">
              {t('app.tagline')}
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">{nav}</div>
        <div className="border-t border-zrh-border p-3">
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-zrh-text-dim transition-colors hover:bg-zrh-surface-raised hover:text-zrh-text"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {t('auth.logout')}
          </button>
        </div>
      </aside>

      {/* 移动抽屉 */}
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
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: motionTokens.duration.base, ease: motionTokens.ease.out }}
              className="zrh-shell-aside flex h-full w-[80%] max-w-full flex-col overflow-x-hidden bg-zrh-surface shadow-zrh-raised"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zrh-border px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
                <div className="flex min-w-0 items-center gap-2">
                  <BrandMark size={30} className="h-8 w-8 shrink-0 rounded-zrh-md shadow-zrh-glow" />
                  <span className="truncate text-sm font-semibold tracking-brand text-zrh-accent">{brand.name}</span>
                </div>
                <button type="button" onClick={() => setDrawerOpen(false)} aria-label={t('common.close')} className="rounded-lg p-1.5">
                  <X className="h-5 w-5 text-zrh-text-dim" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">{nav}</div>
              <div className="border-t border-zrh-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    void logout();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-zrh-text-dim hover:bg-zrh-surface-raised hover:text-zrh-text"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  {t('auth.logout')}
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden">
        <header className="zrh-shell-header z-30 shrink-0 border-b border-zrh-border bg-zrh-bg/90 backdrop-blur">
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
              <span className="ml-1 hidden truncate text-sm font-medium text-zrh-text-dim lg:inline">
                {profile?.displayName ?? profile?.username}
              </span>
            </div>

            <div className="flex items-center justify-center gap-1.5 lg:hidden">
              <BrandMark size={20} className="h-5 w-5 rounded-zrh-sm" />
              <span className="text-sm font-semibold tracking-brand text-zrh-accent">{brand.name}</span>
              <LanguageSwitcher compact />
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
              <div className="hidden lg:block">
                <LanguageSwitcher compact />
              </div>
              <ZButton variant="ghost" size="sm" className="min-h-8 px-2 text-xs" onClick={() => void logout()}>
                {t('auth.logout')}
              </ZButton>
            </div>
          </div>
        </header>

        {/* 仅 Content 纵向滚动 */}
        <main className="zrh-shell-content min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto">
          <div key={location.pathname + location.search} className="zrh-page-enter min-h-full max-w-full overflow-x-hidden">
            <Outlet />
          </div>
        </main>

        {/* 手机底栏 */}
        <nav
          className="zrh-bottom-nav z-30 shrink-0 border-t border-zrh-border bg-zrh-bg/95 backdrop-blur lg:hidden"
          aria-label={t('shell.bottomNav')}
        >
          <div className="zrh-bottom-nav-inner flex items-stretch justify-around px-1">
            {bottomItems.map((item) => {
              const active = bottomActive(item.to, item.end);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium leading-tight ${
                    active ? 'text-zrh-accent' : 'text-zrh-text-dim'
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                  <span className="max-w-full truncate">{item.label}</span>
                </NavLink>
              );
            })}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium leading-tight text-zrh-text-dim"
              aria-label={t('shell.more')}
            >
              <MoreHorizontal className="h-5 w-5 shrink-0" aria-hidden />
              <span>{t('shell.more')}</span>
            </button>
          </div>
        </nav>
      </div>
      <ZToastHost />
    </div>
  );
}
