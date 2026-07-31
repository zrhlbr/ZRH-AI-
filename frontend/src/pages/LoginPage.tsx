import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { TechBackground } from '../components/background/TechBackground';
import { DigitalGlobe } from '../components/background/DigitalGlobe';
import { ZButton, ZInput } from '../components/ui';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { brand } from '../design-system/theme';
import { fadeInUp, baseTransition } from '../design-system/animations';
import { api, ApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';

/**
 * 登录页 — 左侧数字地球科技背景，右侧管理员登录面板。
 */
export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setTokens, setProfile } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const tokens = await api.login(username.trim(), password);
      setTokens(tokens.accessToken, tokens.refreshToken);
      const profile = await api.profile();
      setProfile(profile);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.loginFailed'));
      setLoading(false);
    }
  };

  return (
    <TechBackground>
      <div className="flex min-h-screen">
        {/* 左侧：数字地球 + 品牌 */}
        <div className="relative hidden flex-1 items-center justify-center md:flex">
          <DigitalGlobe className="absolute inset-0 h-full w-full" />
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ ...baseTransition, delay: 0.1 }}
            className="relative z-10 text-center"
          >
            <h1 className="text-5xl font-bold tracking-[0.25em] text-zrh-accent lg:text-6xl">
              {brand.name}
            </h1>
            <p className="mt-4 text-sm text-zrh-text-dim">{brand.groupZh}</p>
            <p className="mt-1 text-xs tracking-[0.25em] text-zrh-text-dim/80">{brand.groupEn}</p>
          </motion.div>
        </div>

        {/* 右侧：登录面板 */}
        <div className="flex w-full items-center justify-center px-4 md:w-[440px] md:border-l md:border-zrh-border md:bg-zrh-surface/40 md:backdrop-blur-xl">
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={baseTransition}
            className="w-full max-w-sm"
          >
            <div className="mb-8 text-center md:hidden">
              <h1 className="text-4xl font-bold tracking-[0.25em] text-zrh-accent">{brand.logo}</h1>
              <p className="mt-2 text-xs text-zrh-text-dim">{brand.subtitle}</p>
            </div>

            <div className="zrh-glass zrh-glow-border zrh-hud rounded-2xl p-6 sm:p-8">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zrh-text">{t('auth.adminLogin')}</h2>
                <LanguageSwitcher />
              </div>

              <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
                <ZInput
                  label={t('auth.username')}
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
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

                {error && (
                  <p className="rounded-lg border border-zrh-err/40 bg-zrh-err/10 px-3 py-2 text-xs text-zrh-err">
                    {t('auth.loginFailed')}: {error}
                  </p>
                )}

                <ZButton type="submit" size="lg" loading={loading} className="mt-2 w-full">
                  {loading ? t('auth.loggingIn') : t('auth.login')}
                </ZButton>
              </form>
            </div>

            <p className="mt-6 text-center text-[10px] text-zrh-text-dim">{brand.copyright}</p>
          </motion.div>
        </div>
      </div>
    </TechBackground>
  );
}
