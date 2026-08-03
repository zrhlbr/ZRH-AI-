import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { TechBackground } from '../components/background/TechBackground';
import { AiCore } from '../components/background/AiCore';
import { ZButton, ZInput } from '../components/ui';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { brand } from '../design-system/theme';
import { BrandMark } from '../design-system/BrandMark';
import { fadeInUp, baseTransition } from '../design-system/animations';
import { api, ApiError } from '../api/client';
import { v12Api } from '../api/v12';
import { useAuthStore } from '../store/authStore';

const REMEMBER_KEY = 'zrh-ai-remember-account';

/**
 * 登录中心 — 账号 / 手机号 / 邮箱 + Remember Me + 三语言
 */
export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setTokens, setProfile } = useAuthStore();

  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setAccount(saved);
        setRememberMe(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const tokens = await v12Api.login(account.trim(), password, rememberMe);
      setTokens(tokens.accessToken, tokens.refreshToken);
      try {
        if (rememberMe) window.localStorage.setItem(REMEMBER_KEY, account.trim());
        else window.localStorage.removeItem(REMEMBER_KEY);
      } catch {
        // ignore
      }
      const profile = await api.profile();
      setProfile(profile);
      navigate('/home', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.loginFailed'));
      setLoading(false);
    }
  };

  return (
    <TechBackground variant="auth" globe={false}>
      <div className="flex min-h-dvh">
        {/* 左侧：超大 AI 科技球 + 品牌 */}
        <div className="relative hidden flex-1 items-center justify-center md:flex">
          <AiCore className="absolute inset-0 h-full w-full scale-110 opacity-80" />
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ ...baseTransition, delay: 0.1 }}
            className="relative z-10 flex flex-col items-center px-8 text-center"
          >
            <BrandMark size={192} className="zrh-logo-glow h-40 w-40 rounded-[2rem] lg:h-48 lg:w-48" />
            <h1 className="zrh-landing-display mt-8 text-5xl lg:text-6xl">{brand.name}</h1>
            <p className="zrh-landing-lead mt-5">{brand.groupZh}</p>
            <p className="zrh-landing-meta mt-2">{brand.groupEn}</p>
          </motion.div>
        </div>

        {/* 右侧：登录面板 */}
        <div className="zrh-auth-stack w-full md:w-[26.5rem] md:border-l md:border-zrh-border/50 md:bg-transparent md:px-8">
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={baseTransition}
            className="w-full max-w-[22rem]"
          >
            <div className="mb-9 flex flex-col items-center text-center md:hidden">
              <BrandMark size={96} className="zrh-logo-glow h-[4.5rem] w-[4.5rem] rounded-zrh-2xl" />
              <h1 className="zrh-landing-display mt-4 text-[2rem]">{brand.logo}</h1>
              <p className="zrh-landing-meta mt-2">{brand.subtitle}</p>
            </div>

            <div className="zrh-glass-card rounded-zrh-2xl px-5 py-6 sm:px-8 sm:py-8">
              <div className="mb-7 flex items-center justify-between gap-3">
                <h2 className="zrh-auth-title">{t('auth.loginTitle')}</h2>
                <LanguageSwitcher compact />
              </div>

              <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
                <ZInput
                  label={t('auth.account')}
                  name="account"
                  autoComplete="username"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder={t('auth.accountHint')}
                  required
                />
                <ZInput
                  label={t('auth.password')}
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <label className="flex items-center gap-2.5 text-xs text-zrh-text-dim">
                  <input
                    type="checkbox"
                    className="zrh-checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  {t('auth.rememberMe')}
                </label>

                {error && (
                  <p className="rounded-lg border border-zrh-err/40 bg-zrh-err/10 px-3 py-2 text-xs text-zrh-err">
                    {t('auth.loginFailed')}: {error}
                  </p>
                )}

                <ZButton type="submit" size="lg" loading={loading} className="mt-1 w-full font-semibold">
                  {loading ? t('auth.loggingIn') : t('auth.login')}
                </ZButton>
              </form>

              <div className="mt-6 flex items-center justify-between text-xs text-zrh-text-dim">
                <Link to="/register" className="font-medium text-zrh-accent hover:underline">
                  {t('auth.register')}
                </Link>
                <Link to="/forgot-password" className="hover:text-zrh-accent">
                  {t('auth.forgotPassword')}
                </Link>
              </div>
            </div>

            <p className="zrh-landing-meta mt-8 text-center">
              <Link to="/release-notes" className="text-zrh-accent hover:underline">
                {t('releaseNotes.link')}
              </Link>
              <span className="mx-2 text-zrh-border">·</span>
              <span>{brand.copyright}</span>
            </p>
          </motion.div>
        </div>
      </div>
    </TechBackground>
  );
}
