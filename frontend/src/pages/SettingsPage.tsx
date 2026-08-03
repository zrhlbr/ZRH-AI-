import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Mail, Info, Languages, Palette, LogOut, ChevronRight } from 'lucide-react';
import { brand } from '../design-system/theme';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { themes, themeOrder, type ZrhThemeId } from '../design-system/theme';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';

/**
 * 设置 — 语言 / 主题 / 预留项 / 关于 / 退出
 */
export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { clear, refreshToken } = useAuthStore();
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

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="mb-6 text-center text-xl font-semibold text-zrh-text">{t('nav.settings')}</h1>

      <div className="overflow-hidden rounded-2xl border border-zrh-border bg-zrh-surface">
        <div className="flex items-start gap-3 border-b border-zrh-border/60 px-4 py-3.5">
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-zrh-accent/10 text-zrh-accent">
            <Languages className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zrh-text">{t('settings.language')}</p>
            <p className="mt-0.5 text-caption text-zrh-text-dim">{t('settings.languageHint')}</p>
            <div className="mt-2">
              <LanguageSwitcher compact />
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 border-b border-zrh-border/60 px-4 py-3.5">
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-zrh-accent/10 text-zrh-accent">
            <Palette className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zrh-text">{t('settings.theme')}</p>
            <p className="mt-0.5 text-caption text-zrh-text-dim">{t('settings.themeHint')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {themeOrder.map((id: ZrhThemeId) => {
                const theme = themes[id];
                const swatch = theme.scheme === 'light' ? theme.colors.bg : theme.colors.accent;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    title={t(theme.labelKey)}
                    onClick={() => setTheme(theme.id)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
                      themeId === theme.id
                        ? 'border-zrh-accent bg-zrh-accent/10 text-zrh-accent'
                        : 'border-zrh-border text-zrh-text-dim'
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full border border-zrh-border" style={{ backgroundColor: swatch }} />
                    {t(theme.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-b border-zrh-border/60 px-4 py-3.5 opacity-60">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zrh-surface-raised text-zrh-text-dim">
            <Bell className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zrh-text">{t('settings.notifications')}</p>
            <p className="text-caption text-zrh-text-dim">{t('common.reserved')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3.5 opacity-60">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zrh-surface-raised text-zrh-text-dim">
            <Mail className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zrh-text">{t('settings.mail')}</p>
            <p className="text-caption text-zrh-text-dim">{t('common.reserved')}</p>
          </div>
        </div>
      </div>

      <Link
        to="/release-notes"
        className="mt-4 flex items-center gap-3 rounded-2xl border border-zrh-border bg-zrh-surface px-4 py-3.5 transition-colors hover:bg-zrh-surface-raised"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zrh-accent/10 text-zrh-accent">
          <Info className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-zrh-text">{t('settings.about')}</span>
          <span className="block text-caption text-zrh-text-dim">
            {brand.name} · v{brand.appVersion}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-zrh-text-dim" aria-hidden />
      </Link>

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
