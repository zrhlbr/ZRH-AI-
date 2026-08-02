import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { TechBackground } from '../components/background/TechBackground';
import { DigitalGlobe } from '../components/background/DigitalGlobe';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { PwaInstallPrompt } from '../components/PwaInstallPrompt';
import { ZButton, ZSkeletonLines } from '../components/ui';
import { BrandMark } from '../design-system/BrandMark';
import { brand } from '../design-system/theme';
import { fadeInUp, baseTransition } from '../design-system/animations';
import { useAuthStore } from '../store/authStore';
import { ensureSession } from '../api/client';

/**
 * 公网落地页（未登录）：立即注册 / 登录 / 安装 ZRH AI
 * 已登录 → 工作台 /home
 */
export function LandingPage() {
  const { t } = useTranslation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const profile = useAuthStore((s) => s.profile);
  const [booting, setBooting] = useState(Boolean(refreshToken && !accessToken));

  useEffect(() => {
    if (accessToken || !refreshToken) {
      setBooting(false);
      return;
    }
    let alive = true;
    void ensureSession().finally(() => {
      if (alive) setBooting(false);
    });
    return () => {
      alive = false;
    };
  }, [accessToken, refreshToken]);

  if (booting) {
    return (
      <div className="mx-auto max-w-md space-y-3 px-4 py-16">
        <ZSkeletonLines lines={4} />
      </div>
    );
  }

  if (accessToken && profile) {
    return <Navigate to="/home" replace />;
  }

  return (
    <TechBackground>
      <div className="relative flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandMark size={36} className="h-9 w-9 rounded-zrh-md shadow-zrh-glow" />
            <span className="text-sm font-bold tracking-brand text-zrh-accent">{brand.name}</span>
          </div>
          <LanguageSwitcher />
        </header>

        <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pb-16 pt-6 text-center sm:px-6">
          <DigitalGlobe className="pointer-events-none absolute -top-8 left-1/2 h-64 w-64 -translate-x-1/2 opacity-45 sm:h-72 sm:w-72" />
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={baseTransition}
            className="relative z-10 flex w-full flex-col items-center"
          >
            <BrandMark size={96} className="mb-5 h-20 w-20 rounded-zrh-2xl shadow-zrh-glow sm:h-24 sm:w-24" />
            <h1 className="text-3xl font-bold tracking-brand text-zrh-accent sm:text-5xl">{brand.name}</h1>
            <p className="mt-3 max-w-md text-sm text-zrh-text-dim sm:text-base">{t('app.tagline')}</p>
            <p className="mt-2 text-caption tracking-hud text-zrh-text-dim/80 sm:text-xs">{brand.groupEn}</p>

            <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:max-w-lg sm:flex-row sm:justify-center">
              <Link to="/register" className="w-full sm:w-auto sm:min-w-[10rem]">
                <ZButton type="button" size="lg" className="min-h-12 w-full text-base">
                  {t('landing.registerNow')}
                </ZButton>
              </Link>
              <Link to="/login" className="w-full sm:w-auto sm:min-w-[10rem]">
                <ZButton type="button" variant="secondary" size="lg" className="min-h-12 w-full text-base">
                  {t('landing.login')}
                </ZButton>
              </Link>
            </div>

            <div className="mt-3 w-full max-w-md sm:max-w-lg">
              <PwaInstallPrompt variant="button" className="w-full" />
            </div>

            <div className="mt-6 w-full max-w-xl">
              <PwaInstallPrompt variant="card" />
            </div>
          </motion.div>
        </main>

        <footer className="flex flex-col items-center gap-2 px-4 py-5 text-center text-caption text-zrh-text-dim">
          <Link to="/release-notes" className="text-zrh-accent hover:underline">
            {t('releaseNotes.link')} · {t('releaseNotes.currentVersion', { version: brand.appVersion })}
          </Link>
          <p>{brand.copyright}</p>
        </footer>
      </div>
    </TechBackground>
  );
}
