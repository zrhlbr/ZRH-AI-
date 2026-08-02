import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Share, X } from 'lucide-react';
import {
  BeforeInstallPromptEvent,
  dismissInstallPrompt,
  isDismissedRecently,
  isIosDevice,
  isStandaloneDisplay,
} from '../pwa/install';
import { BrandMark } from '../design-system/BrandMark';
import { ZButton } from './ui';

type Props = {
  /** compact = inline CTA only; card = guided panel */
  variant?: 'card' | 'button';
  className?: string;
};

/**
 * Android: beforeinstallprompt → native install.
 * iOS: Share → Add to Home Screen instructions.
 * Respects 7-day dismiss + standalone hide.
 */
export function PwaInstallPrompt({ variant = 'card', className = '' }: Props) {
  const { t } = useTranslation();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosOpen, setIosOpen] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandaloneDisplay() || isDismissedRecently()) {
      setHidden(true);
      return;
    }
    setHidden(false);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  if (hidden && variant === 'card') return null;

  const onInstall = async () => {
    if (deferred) {
      await deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {
        // ignore
      }
      setDeferred(null);
      return;
    }
    if (isIosDevice()) {
      setIosOpen(true);
      return;
    }
    // Desktop Chromium without bip yet — still show tip
    setIosOpen(true);
  };

  const onLater = () => {
    dismissInstallPrompt(7);
    setHidden(true);
    setIosOpen(false);
  };

  if (variant === 'button') {
    if (isStandaloneDisplay()) return null;
    return (
      <div className={`w-full ${className}`}>
        <ZButton
          type="button"
          variant="secondary"
          size="lg"
          className="min-h-12 w-full"
          onClick={() => void onInstall()}
        >
          <Download className="mr-2 h-4 w-4" aria-hidden />
          {t('pwa.install')}
        </ZButton>
        {iosOpen && (
          <ol className="mt-3 space-y-2 rounded-zrh-lg border border-zrh-border bg-zrh-surface-raised/90 px-3 py-3 text-left text-xs leading-relaxed text-zrh-text">
            <li className="flex gap-2">
              <span className="font-semibold text-zrh-accent">1.</span>
              <span>
                {t('pwa.iosStep1')}{' '}
                <Share className="inline h-3.5 w-3.5 text-zrh-accent" aria-hidden />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-zrh-accent">2.</span>
              <span>{t('pwa.iosStep2')}</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-zrh-accent">3.</span>
              <span>{t('pwa.iosStep3')}</span>
            </li>
            <li>
              <button type="button" className="text-zrh-text-dim underline" onClick={onLater}>
                {t('pwa.later')}
              </button>
            </li>
          </ol>
        )}
      </div>
    );
  }

  if (hidden) return null;

  return (
    <div
      className={`zrh-glass zrh-glow-border relative w-full max-w-xl rounded-zrh-2xl p-4 sm:p-5 ${className}`}
      role="region"
      aria-label={t('pwa.install')}
    >
      <button
        type="button"
        className="absolute right-3 top-3 rounded-zrh-md p-1.5 text-zrh-text-dim hover:bg-zrh-surface-raised hover:text-zrh-text"
        aria-label={t('common.close')}
        onClick={onLater}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <BrandMark size={48} className="h-12 w-12 shrink-0 rounded-zrh-lg shadow-zrh-glow" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zrh-text">{t('pwa.install')}</p>
          <p className="mt-1 text-caption text-zrh-text-dim sm:text-xs">{t('pwa.installHint')}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <ZButton type="button" size="md" className="min-h-11" onClick={() => void onInstall()}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden />
              {t('pwa.install')}
            </ZButton>
            <ZButton type="button" variant="ghost" size="md" className="min-h-11" onClick={onLater}>
              {t('pwa.later')}
            </ZButton>
          </div>
          {(iosOpen || (isIosDevice() && !deferred)) && (
            <ol className="mt-4 space-y-2 rounded-zrh-lg bg-zrh-surface-raised/80 px-3 py-3 text-xs leading-relaxed text-zrh-text">
              <li className="flex gap-2">
                <span className="font-semibold text-zrh-accent">1.</span>
                <span>
                  {t('pwa.iosStep1')}{' '}
                  <Share className="inline h-3.5 w-3.5 text-zrh-accent" aria-hidden />
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-zrh-accent">2.</span>
                <span>{t('pwa.iosStep2')}</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-zrh-accent">3.</span>
                <span>{t('pwa.iosStep3')}</span>
              </li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
