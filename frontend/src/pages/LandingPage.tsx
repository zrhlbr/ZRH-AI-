import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { TechBackground } from '../components/background/TechBackground';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { PwaInstallPrompt } from '../components/PwaInstallPrompt';
import { ZButton, ZSkeletonLines } from '../components/ui';
import { BrandMark } from '../design-system/BrandMark';
import { brand } from '../design-system/theme';
import { fadeInUp, baseTransition } from '../design-system/animations';
import { useAuthStore } from '../store/authStore';
import { ensureSession } from '../api/client';

/**
 * 公网落地页（未登录）— Official AI Cosmos Background V3.0
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
    <TechBackground variant="landing" globe>
      <div className="relative flex min-h-dvh flex-col">
        <header className="zrh-landing-header relative z-20">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark size={36} className="zrh-logo-glow h-9 w-9 shrink-0 rounded-zrh-md" />
            <span className="truncate text-sm font-semibold tracking-brand text-zrh-accent">
              {brand.name}
            </span>
          </div>
          <LanguageSwitcher compact />
        </header>

        <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 pb-14 pt-10 text-center sm:px-8 sm:pb-16 sm:pt-14">
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={baseTransition}
            className="relative z-10 flex w-full flex-col items-center"
          >
            <BrandMark
              size={96}
              className="zrh-logo-glow mb-7 h-[4.5rem] w-[4.5rem] rounded-zrh-2xl sm:mb-8 sm:h-24 sm:w-24"
            />
            <h1 className="zrh-landing-display text-[1.875rem] sm:text-5xl">{brand.name}</h1>
            <p className="zrh-landing-lead mt-4 max-w-md px-1">{t('app.tagline')}</p>
            <p className="zrh-landing-meta mt-3">{brand.groupEn}</p>

            <div className="zrh-landing-cta-group mt-10 sm:mt-12">
              <Link to="/register" className="w-full sm:w-auto">
                <ZButton type="button" size="lg" className="min-h-12 w-full text-base font-semibold">
                  {t('landing.registerNow')}
                </ZButton>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <ZButton
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="min-h-12 w-full text-base font-medium"
                >
                  {t('landing.login')}
                </ZButton>
              </Link>
            </div>

            <div className="mt-5 w-full max-w-md sm:max-w-lg">
              <PwaInstallPrompt variant="button" className="w-full" />
            </div>

            <div className="mt-8 w-full max-w-xl">
              <PwaInstallPrompt variant="card" />
            </div>
          </motion.div>
        </main>

        <footer
          className="flex flex-col items-center gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 text-center text-caption text-zrh-text-dim"
        >
          <Link to="/release-notes" className="text-zrh-accent hover:underline">
            {t('releaseNotes.link')} · {t('releaseNotes.currentVersion', { version: brand.appVersion })}
          </Link>
          <p className="zrh-landing-meta">{brand.copyright}</p>
        </footer>
      </div>
    </TechBackground>
  );
}
