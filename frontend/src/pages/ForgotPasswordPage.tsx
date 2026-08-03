import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { TechBackground } from '../components/background/TechBackground';
import { ZButton, ZInput } from '../components/ui';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { brand } from '../design-system/theme';
import { BrandMark } from '../design-system/BrandMark';
import { fadeInUp, baseTransition } from '../design-system/animations';
import { ApiError } from '../api/client';
import { v12Api } from '../api/v12';

/**
 * 忘记密码 — 邮箱找回（手机预留）+ 使用 token 重置
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [account, setAccount] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestReset = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await v12Api.forgotPassword(account.trim(), 'email');
      setMessage(res.message || t('auth.resetIssued'));
      if (res.devToken) {
        setToken(res.devToken);
        setStep('reset');
      } else {
        setStep('reset');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  const doReset = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await v12Api.resetPassword(token.trim(), newPassword);
      setMessage(t('auth.resetSuccess'));
      setTimeout(() => navigate('/login', { replace: true }), 800);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.resetFailed'));
      setLoading(false);
    }
  };

  return (
    <TechBackground variant="auth" globe>
      <div className="zrh-auth-stack">
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={baseTransition}
          className="relative z-10 w-full max-w-sm"
        >
          <div className="mb-8 text-center">
            <BrandMark size={72} className="zrh-logo-glow mx-auto mb-4 h-[72px] w-[72px] rounded-2xl" />
            <h1 className="zrh-landing-display text-3xl">{brand.logo}</h1>
            <p className="zrh-landing-meta mt-2.5">{t('auth.forgotTitle')}</p>
          </div>

          <div className="zrh-glass-card rounded-2xl px-5 py-6 sm:px-8 sm:py-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="zrh-auth-title">{t('auth.forgotPassword')}</h2>
              <LanguageSwitcher compact />
            </div>

            {step === 'request' ? (
              <form onSubmit={(e) => void requestReset(e)} className="flex flex-col gap-4">
                <ZInput
                  label={t('auth.account')}
                  name="account"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  required
                  placeholder={t('auth.accountHint')}
                />
                <p className="text-[11px] text-zrh-text-dim">{t('auth.phoneResetReserved')}</p>
                {message && (
                  <p className="rounded-lg border border-zrh-accent/30 bg-zrh-accent/10 px-3 py-2 text-xs text-zrh-accent">
                    {message}
                  </p>
                )}
                {error && (
                  <p className="rounded-lg border border-zrh-err/40 bg-zrh-err/10 px-3 py-2 text-xs text-zrh-err">
                    {error}
                  </p>
                )}
                <ZButton type="submit" size="lg" loading={loading} className="w-full">
                  {t('auth.sendReset')}
                </ZButton>
              </form>
            ) : (
              <form onSubmit={(e) => void doReset(e)} className="flex flex-col gap-4">
                <ZInput
                  label={t('auth.resetToken')}
                  name="token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />
                <ZInput
                  label={t('auth.newPassword')}
                  name="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
                {message && (
                  <p className="rounded-lg border border-zrh-accent/30 bg-zrh-accent/10 px-3 py-2 text-xs text-zrh-accent">
                    {message}
                  </p>
                )}
                {error && (
                  <p className="rounded-lg border border-zrh-err/40 bg-zrh-err/10 px-3 py-2 text-xs text-zrh-err">
                    {error}
                  </p>
                )}
                <ZButton type="submit" size="lg" loading={loading} className="w-full">
                  {t('auth.resetPassword')}
                </ZButton>
              </form>
            )}

            <p className="mt-4 text-center text-xs text-zrh-text-dim">
              <Link to="/login" className="text-zrh-accent hover:underline">
                {t('auth.backToLogin')}
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </TechBackground>
  );
}
