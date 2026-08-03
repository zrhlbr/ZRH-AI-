import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  MessageSquare,
  Star,
  Languages,
  Palette,
  Shield,
  User,
  LogOut,
} from 'lucide-react';
import { BrandMark } from '../design-system/BrandMark';
import { useAuthStore } from '../store/authStore';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { themes, themeOrder, type ZrhThemeId } from '../design-system/theme';
import { useThemeStore } from '../store/themeStore';

/**
 * 我的 — 用户产品中心（非企业后台）
 */
export function MePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, clear, refreshToken } = useAuthStore();
  const { themeId, setTheme } = useThemeStore();

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

  const rows: Array<{
    to?: string;
    icon: typeof User;
    label: string;
    hint?: string;
    reserved?: boolean;
    onClick?: () => void;
  }> = [
    { to: '/account', icon: User, label: t('me.profile'), hint: t('me.profileHint') },
    { to: '/chat', icon: MessageSquare, label: t('me.myChats'), hint: t('me.myChatsHint') },
    { icon: Star, label: t('me.favorites'), hint: t('common.reserved'), reserved: true },
    { to: '/account?tab=security', icon: Shield, label: t('me.security'), hint: t('me.securityHint') },
  ];

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <BrandMark size={72} className="mb-3 h-16 w-16 rounded-2xl shadow-zrh-glow" />
        <h1 className="text-xl font-semibold text-zrh-text">{t('nav.me')}</h1>
        <p className="mt-1 text-sm text-zrh-text-dim">
          {profile?.displayName || profile?.username || t('nav.account')}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zrh-border bg-zrh-surface">
        {rows.map((row) => {
          const Icon = row.icon;
          const inner = (
            <>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zrh-accent/10 text-zrh-accent">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-zrh-text">{row.label}</span>
                {row.hint && <span className="block text-caption text-zrh-text-dim">{row.hint}</span>}
              </span>
              {!row.reserved && <ChevronRight className="h-4 w-4 text-zrh-text-dim" aria-hidden />}
            </>
          );
          if (row.reserved) {
            return (
              <div
                key={row.label}
                className="flex items-center gap-3 border-b border-zrh-border/60 px-4 py-3.5 opacity-60 last:border-0"
              >
                {inner}
              </div>
            );
          }
          return (
            <Link
              key={row.label}
              to={row.to!}
              className="flex items-center gap-3 border-b border-zrh-border/60 px-4 py-3.5 transition-colors hover:bg-zrh-surface-raised last:border-0"
            >
              {inner}
            </Link>
          );
        })}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-zrh-border bg-zrh-surface">
        <div className="flex items-center gap-3 border-b border-zrh-border/60 px-4 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zrh-accent/10 text-zrh-accent">
            <Languages className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zrh-text">{t('me.language')}</p>
            <div className="mt-2">
              <LanguageSwitcher compact />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zrh-accent/10 text-zrh-accent">
            <Palette className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zrh-text">{t('me.theme')}</p>
            <div className="mt-2 flex flex-wrap gap-2" aria-label={t('theme.label')}>
              {themeOrder.map((id: ZrhThemeId) => {
                const theme = themes[id];
                const swatch = theme.scheme === 'light' ? theme.colors.bg : theme.colors.accent;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    title={t(theme.labelKey)}
                    onClick={() => setTheme(theme.id)}
                    className={`h-7 w-7 rounded-full border ${
                      themeId === theme.id
                        ? 'scale-110 border-zrh-accent ring-2 ring-zrh-accent/30'
                        : 'border-zrh-border'
                    }`}
                    style={{ backgroundColor: swatch }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void logout()}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-zrh-border bg-zrh-surface px-4 py-3.5 text-sm font-medium text-zrh-err transition-colors hover:bg-zrh-err/5"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        {t('auth.logout')}
      </button>
    </div>
  );
}
