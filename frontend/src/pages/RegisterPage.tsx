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
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';

/**
 * 注册中心 — 用户名 / 邮箱 / 手机号 + 邮箱验证码 + 邀请码（可选）
 */
export function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setTokens, setProfile } = useAuthStore();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const sendEmailCode = async () => {
    if (!email.trim()) {
      setError(t('auth.emailRequired'));
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await v12Api.sendCode(email.trim(), 'email', 'register');
      setHint(res.devCode ? `${t('auth.codeSent')}: ${res.devCode}` : t('auth.codeSent'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.sendCodeFailed'));
    } finally {
      setSending(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!acceptTerms || !acceptPrivacy) {
      setError(t('auth.mustAccept'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tokens = await v12Api.register({
        username: username.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
        displayName: displayName.trim() || undefined,
        emailCode: emailCode.trim() || undefined,
        inviteCode: inviteCode.trim() || undefined,
        acceptTerms,
        acceptPrivacy,
        language: i18n.language,
      });
      setTokens(tokens.accessToken, tokens.refreshToken);
      const profile = await api.profile();
      setProfile(profile);
      navigate('/home', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.registerFailed'));
      setLoading(false);
    }
  };

  return (
    <TechBackground>
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={baseTransition}
          className="w-full max-w-md"
        >
          <div className="mb-6 text-center">
            <BrandMark size={72} className="mx-auto mb-3 h-[72px] w-[72px] rounded-2xl" />
            <h1 className="text-3xl font-bold tracking-brand text-zrh-accent">{brand.logo}</h1>
            <p className="mt-2 text-xs text-zrh-text-dim">{t('auth.registerTitle')}</p>
          </div>

          <div className="zrh-glass zrh-glow-border zrh-hud rounded-2xl p-6 sm:p-8">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zrh-text">{t('auth.register')}</h2>
              <LanguageSwitcher />
            </div>

            <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3.5">
              <ZInput
                label={t('auth.username')}
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
              <ZInput
                label={t('auth.displayName')}
                name="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <ZInput
                    label={t('auth.email')}
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <ZButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-6 shrink-0"
                  loading={sending}
                  onClick={() => void sendEmailCode()}
                >
                  {t('auth.sendCode')}
                </ZButton>
              </div>
              <ZInput
                label={t('auth.emailCode')}
                name="emailCode"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
              />
              <ZInput
                label={`${t('auth.phone')} (${t('common.reserved')})`}
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <ZInput
                label={t('auth.password')}
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <ZInput
                label={`${t('auth.inviteCode')} (${t('common.optional')})`}
                name="inviteCode"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />

              <label className="flex items-start gap-2 text-xs text-zrh-text-dim">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                />
                <span>{t('auth.acceptTerms')}</span>
              </label>
              <label className="flex items-start gap-2 text-xs text-zrh-text-dim">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={acceptPrivacy}
                  onChange={(e) => setAcceptPrivacy(e.target.checked)}
                />
                <span>{t('auth.acceptPrivacy')}</span>
              </label>

              {hint && (
                <p className="rounded-lg border border-zrh-accent/30 bg-zrh-accent/10 px-3 py-2 text-xs text-zrh-accent">
                  {hint}
                </p>
              )}
              {error && (
                <p className="rounded-lg border border-zrh-err/40 bg-zrh-err/10 px-3 py-2 text-xs text-zrh-err">
                  {error}
                </p>
              )}

              <ZButton type="submit" size="lg" loading={loading} className="mt-1 w-full">
                {loading ? t('auth.registering') : t('auth.register')}
              </ZButton>
            </form>

            <p className="mt-4 text-center text-xs text-zrh-text-dim">
              {t('auth.haveAccount')}{' '}
              <Link to="/login" className="text-zrh-accent hover:underline">
                {t('auth.login')}
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </TechBackground>
  );
}
