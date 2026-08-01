import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ZBadge, ZButton, ZCard, ZInput } from '../components/ui';
import { ApiError } from '../api/client';
import { UserCenterMe, v12Api } from '../api/v12';

type Tab = 'profile' | 'security' | 'devices' | 'history' | 'tokens';

/**
 * 用户中心 — 个人资料 / 安全 / 设备 / 登录历史 / API Token（预留）
 */
export function AccountPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('profile');
  const [me, setMe] = useState<UserCenterMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('zh-CN');
  const [bio, setBio] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [devices, setDevices] = useState<Array<Record<string, unknown>>>([]);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [tokenMsg, setTokenMsg] = useState('');

  const load = async () => {
    setError(null);
    try {
      const data = await v12Api.me();
      setMe(data);
      setDisplayName(data.displayName || '');
      setNickname(data.profile?.nickname || '');
      setAvatarUrl(data.profile?.avatarUrl || '');
      setCountry(data.profile?.country || '');
      setLanguage(data.profile?.language || 'zh-CN');
      setBio(data.profile?.bio || '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('account.loadFailed'));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (tab === 'devices') {
      void v12Api.devices().then((r) => setDevices(r.items)).catch(() => setDevices([]));
    }
    if (tab === 'history') {
      void v12Api.loginHistory().then((r) => setHistory(r.items)).catch(() => setHistory([]));
    }
    if (tab === 'tokens') {
      void v12Api.apiTokens().then((r) => setTokenMsg(r.message)).catch(() => setTokenMsg(''));
    }
  }, [tab]);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const data = await v12Api.updateMe({
        displayName,
        nickname,
        avatarUrl,
        country,
        language,
        bio,
      });
      setMe(data);
      setOk(t('account.saved'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('account.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      await v12Api.changePassword(currentPassword, newPassword);
      setOk(t('account.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('account.passwordFailed'));
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: t('account.profile') },
    { id: 'security', label: t('account.security') },
    { id: 'devices', label: t('account.devices') },
    { id: 'history', label: t('account.history') },
    { id: 'tokens', label: t('account.apiTokens') },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-zrh-accent">{t('account.title')}</h1>
        <p className="mt-1 text-xs text-zrh-text-dim">{t('account.subtitle')}</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-zrh-border pb-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
              tab === item.id
                ? 'bg-zrh-accent/15 text-zrh-accent font-semibold'
                : 'text-zrh-text-dim hover:text-zrh-text'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-zrh-err/40 bg-zrh-err/10 px-3 py-2 text-xs text-zrh-err">
          {error}
        </p>
      )}
      {ok && (
        <p className="mb-3 rounded-lg border border-zrh-ok/40 bg-zrh-ok/10 px-3 py-2 text-xs text-zrh-ok">
          {ok}
        </p>
      )}

      {tab === 'profile' && (
        <ZCard title={t('account.profile')} glow>
          {me && (
            <div className="mb-4 flex flex-wrap gap-2 text-xs text-zrh-text-dim">
              <span>@{me.username}</span>
              <ZBadge tone="dim">{me.roleName}</ZBadge>
              {me.email && <span>{me.email}</span>}
              {me.phone && <span>{me.phone}</span>}
            </div>
          )}
          <form onSubmit={(e) => void saveProfile(e)} className="grid gap-3 sm:grid-cols-2">
            <ZInput
              label={t('auth.displayName')}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <ZInput
              label={t('account.nickname')}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            <ZInput
              label={t('account.avatar')}
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://"
            />
            <ZInput
              label={t('account.country')}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
            <label className="flex flex-col gap-1.5 text-xs text-zrh-text-dim sm:text-sm">
              {t('account.language')}
              <select
                className="rounded-lg border border-zrh-border bg-zrh-surface px-3.5 py-2.5 text-sm text-zrh-text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="zh-CN">中文</option>
                <option value="my-MM">မြန်မာ</option>
                <option value="en-US">English</option>
              </select>
            </label>
            <ZInput label={t('account.bio')} value={bio} onChange={(e) => setBio(e.target.value)} />
            <div className="sm:col-span-2">
              <ZButton type="submit" loading={saving}>
                {t('common.save')}
              </ZButton>
            </div>
          </form>
        </ZCard>
      )}

      {tab === 'security' && (
        <ZCard title={t('account.changePassword')} glow>
          <form onSubmit={(e) => void changePassword(e)} className="flex max-w-md flex-col gap-3">
            <ZInput
              label={t('account.currentPassword')}
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <ZInput
              label={t('auth.newPassword')}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
            <ZButton type="submit" loading={saving}>
              {t('account.updatePassword')}
            </ZButton>
          </form>
        </ZCard>
      )}

      {tab === 'devices' && (
        <ZCard title={t('account.devices')} glow>
          {devices.length === 0 ? (
            <p className="text-xs text-zrh-text-dim">{t('common.noData')}</p>
          ) : (
            <ul className="space-y-2">
              {devices.map((d) => (
                <li
                  key={String(d.deviceId)}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zrh-border px-3 py-2 text-xs"
                >
                  <div>
                    <p className="text-zrh-text">{String(d.name || d.deviceId)}</p>
                    <p className="text-zrh-text-dim">
                      {String(d.lastIp || '—')} · {String(d.lastSeenAt || '')}
                    </p>
                  </div>
                  <ZButton
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void v12Api.revokeDevice(String(d.deviceId)).then(() =>
                        setDevices((prev) => prev.filter((x) => x.deviceId !== d.deviceId)),
                      )
                    }
                  >
                    {t('account.revoke')}
                  </ZButton>
                </li>
              ))}
            </ul>
          )}
        </ZCard>
      )}

      {tab === 'history' && (
        <ZCard title={t('account.history')} glow>
          {history.length === 0 ? (
            <p className="text-xs text-zrh-text-dim">{t('common.noData')}</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li
                  key={String(h.id)}
                  className="rounded-lg border border-zrh-border px-3 py-2 text-xs text-zrh-text-dim"
                >
                  <span className={h.success ? 'text-zrh-ok' : 'text-zrh-err'}>
                    {h.success ? 'OK' : 'FAIL'}
                  </span>{' '}
                  · {String(h.method)} · {String(h.ip || '—')} · {String(h.createdAt || '')}
                </li>
              ))}
            </ul>
          )}
        </ZCard>
      )}

      {tab === 'tokens' && (
        <ZCard title={t('account.apiTokens')} glow>
          <p className="text-xs text-zrh-text-dim">{tokenMsg || t('common.reserved')}</p>
        </ZCard>
      )}
    </div>
  );
}
