import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ZBadge, ZButton, ZCard, ZEmpty, ZInput, ZSkeleton } from '../components/ui';
import { ApiError } from '../api/client';
import { v12Api } from '../api/v12';

const PASSWORD_MASK = '********';

export function MailCenterView() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [encryption, setEncryption] = useState('starttls');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('ZRHLBR');
  const [replyTo, setReplyTo] = useState('');
  const [timeoutMs, setTimeoutMs] = useState('15000');
  const [configured, setConfigured] = useState(false);

  const [codeLen, setCodeLen] = useState('6');
  const [ttl, setTtl] = useState('600');
  const [interval, setIntervalSec] = useState('60');
  const [daily, setDaily] = useState('20');
  const [retries, setRetries] = useState('3');

  const [templates, setTemplates] = useState<
    Array<{
      id: number;
      type: string;
      locale: string;
      subject: string;
      enabled: boolean;
      version: number;
      updatedAt: string;
    }>
  >([]);
  const [logs, setLogs] = useState<
    Array<{
      id: number;
      toMasked: string;
      templateType: string;
      status: string;
      provider: string;
      messageId: string | null;
      attempts: number;
      errorCode: string | null;
      errorMessage: string | null;
      createdAt: string;
      completedAt: string | null;
    }>
  >([]);
  const [testTo, setTestTo] = useState('');
  const [runtime, setRuntime] = useState<Record<string, unknown> | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [status, tpls, logRes] = await Promise.all([
        v12Api.mailStatus(),
        v12Api.mailTemplates(),
        v12Api.mailLogs({ take: 30 }),
      ]);
      const smtp = status.smtp;
      setHost(smtp.host);
      setPort(String(smtp.port));
      setUsername(smtp.username);
      setPassword(smtp.passwordConfigured ? PASSWORD_MASK : '');
      setPasswordConfigured(smtp.passwordConfigured);
      setEncryption(smtp.encryption);
      setFromEmail(smtp.fromEmail);
      setFromName(smtp.fromName);
      setReplyTo(smtp.replyTo);
      setTimeoutMs(String(smtp.connectionTimeoutMs));
      setConfigured(smtp.configured);
      setCodeLen(String(status.codePolicy.length));
      setTtl(String(status.codePolicy.ttlSeconds));
      setIntervalSec(String(status.codePolicy.intervalSeconds));
      setDaily(String(status.codePolicy.dailyLimit));
      setRetries(String(status.codePolicy.maxRetries));
      setRuntime(status.runtime);
      setTemplates(tpls.items);
      setLogs(logRes.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveSmtp = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await v12Api.mailSaveSmtp({
        host,
        port: Number(port),
        username,
        password: password === PASSWORD_MASK ? PASSWORD_MASK : password,
        encryption,
        fromEmail,
        fromName,
        replyTo: replyTo || undefined,
        connectionTimeoutMs: Number(timeoutMs),
      });
      setPassword(r.passwordConfigured ? PASSWORD_MASK : '');
      setPasswordConfigured(r.passwordConfigured);
      setConfigured(r.configured);
      setMsg(t('mailCenter.saved'));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'error');
    }
  };

  const savePolicy = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await v12Api.mailSaveCodePolicy({
        length: Number(codeLen),
        ttlSeconds: Number(ttl),
        intervalSeconds: Number(interval),
        dailyLimit: Number(daily),
        maxRetries: Number(retries),
      });
      setMsg(t('mailCenter.saved'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'error');
    }
  };

  const onTestConn = async () => {
    setMsg(null);
    try {
      const r = await v12Api.mailTestConnection();
      setMsg(r.message || t('mailCenter.testOk'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'error');
    }
  };

  const onTestSend = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await v12Api.mailTestSend({ to: testTo, templateType: 'system_notice', locale: 'zh-CN' });
      setMsg(t('mailCenter.testSent'));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'error');
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <ZSkeleton className="h-7 w-48" />
        <ZSkeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error && !configured && templates.length === 0) {
    return <ZEmpty title={t('common.error')} description={error} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-lg font-semibold tracking-wide text-zrh-accent">
          {t('mailCenter.title')}
        </h1>
        <p className="mt-1 text-xs text-zrh-text-dim">{t('mailCenter.subtitle')}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <ZBadge tone={configured ? 'ok' : 'dim'}>
            {configured ? t('mailCenter.smtpReady') : t('mailCenter.smtpMissing')}
          </ZBadge>
          {runtime && (
            <ZBadge tone="dim">
              MAIL_DEV_CODE_ENABLED={String(runtime.mailDevCodeEnabled)}
            </ZBadge>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
      {msg && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {msg}
        </p>
      )}

      <ZCard title={t('mailCenter.smtp')} glow>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveSmtp}>
          <ZInput label={t('mailCenter.host')} value={host} onChange={(e) => setHost(e.target.value)} required />
          <ZInput label={t('mailCenter.port')} value={port} onChange={(e) => setPort(e.target.value)} required />
          <ZInput
            label={t('mailCenter.username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <ZInput
            label={t('mailCenter.password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={passwordConfigured ? PASSWORD_MASK : ''}
          />
          <label className="text-xs text-zrh-text-dim">
            {t('mailCenter.encryption')}
            <select
              className="mt-1 w-full rounded-lg border border-zrh-border bg-zrh-bg px-3 py-2 text-sm text-zrh-text"
              value={encryption}
              onChange={(e) => setEncryption(e.target.value)}
            >
              <option value="none">none</option>
              <option value="ssl">ssl</option>
              <option value="tls">tls</option>
              <option value="starttls">starttls</option>
            </select>
          </label>
          <ZInput
            label={t('mailCenter.fromEmail')}
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            required
          />
          <ZInput
            label={t('mailCenter.fromName')}
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
          />
          <ZInput
            label={t('mailCenter.replyTo')}
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
          />
          <ZInput
            label={t('mailCenter.timeout')}
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(e.target.value)}
          />
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
            <ZButton type="submit">{t('mailCenter.saveSmtp')}</ZButton>
            <ZButton type="button" variant="ghost" onClick={() => void onTestConn()}>
              {t('mailCenter.testConnection')}
            </ZButton>
          </div>
        </form>
      </ZCard>

      <ZCard title={t('mailCenter.codePolicy')} glow>
        <form className="grid gap-3 sm:grid-cols-3" onSubmit={savePolicy}>
          <ZInput label={t('mailCenter.codeLength')} value={codeLen} onChange={(e) => setCodeLen(e.target.value)} />
          <ZInput label={t('mailCenter.ttl')} value={ttl} onChange={(e) => setTtl(e.target.value)} />
          <ZInput
            label={t('mailCenter.interval')}
            value={interval}
            onChange={(e) => setIntervalSec(e.target.value)}
          />
          <ZInput label={t('mailCenter.dailyLimit')} value={daily} onChange={(e) => setDaily(e.target.value)} />
          <ZInput label={t('mailCenter.maxRetries')} value={retries} onChange={(e) => setRetries(e.target.value)} />
          <div className="flex items-end">
            <ZButton type="submit">{t('mailCenter.savePolicy')}</ZButton>
          </div>
        </form>
      </ZCard>

      <ZCard title={t('mailCenter.testSend')} glow>
        <form className="flex flex-wrap items-end gap-2" onSubmit={onTestSend}>
          <div className="min-w-[220px] flex-1">
            <ZInput
              label={t('mailCenter.testTo')}
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              required
            />
          </div>
          <ZButton type="submit">{t('mailCenter.sendTest')}</ZButton>
        </form>
      </ZCard>

      <ZCard title={t('mailCenter.templates')} glow>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-zrh-text-dim">
              <tr>
                <th className="px-2 py-1.5">{t('mailCenter.type')}</th>
                <th className="px-2 py-1.5">{t('mailCenter.locale')}</th>
                <th className="px-2 py-1.5">{t('mailCenter.subject')}</th>
                <th className="px-2 py-1.5">{t('mailCenter.version')}</th>
                <th className="px-2 py-1.5">{t('mailCenter.enabled')}</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((row) => (
                <tr key={row.id} className="border-t border-zrh-border/60">
                  <td className="px-2 py-1.5 text-zrh-text">{row.type}</td>
                  <td className="px-2 py-1.5">{row.locale}</td>
                  <td className="max-w-[240px] truncate px-2 py-1.5">{row.subject}</td>
                  <td className="px-2 py-1.5">v{row.version}</td>
                  <td className="px-2 py-1.5">
                    <ZBadge tone={row.enabled ? 'ok' : 'dim'}>
                      {row.enabled ? t('common.on') : t('common.off')}
                    </ZBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ZCard>

      <ZCard title={t('mailCenter.logs')} glow>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-zrh-text-dim">
              <tr>
                <th className="px-2 py-1.5">{t('mailCenter.to')}</th>
                <th className="px-2 py-1.5">{t('mailCenter.type')}</th>
                <th className="px-2 py-1.5">{t('mailCenter.status')}</th>
                <th className="px-2 py-1.5">Provider</th>
                <th className="px-2 py-1.5">{t('mailCenter.attempts')}</th>
                <th className="px-2 py-1.5">{t('mailCenter.error')}</th>
                <th className="px-2 py-1.5">{t('mailCenter.time')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-zrh-text-dim">
                    {t('common.empty')}
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <tr key={row.id} className="border-t border-zrh-border/60">
                    <td className="px-2 py-1.5">{row.toMasked}</td>
                    <td className="px-2 py-1.5">{row.templateType}</td>
                    <td className="px-2 py-1.5">
                      <ZBadge tone={row.status === 'sent' ? 'ok' : row.status === 'failed' ? 'warn' : 'dim'}>
                        {row.status}
                      </ZBadge>
                    </td>
                    <td className="px-2 py-1.5">{row.provider}</td>
                    <td className="px-2 py-1.5">{row.attempts}</td>
                    <td className="max-w-[200px] truncate px-2 py-1.5 text-zrh-text-dim">
                      {row.errorCode || row.errorMessage || '—'}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ZCard>
    </div>
  );
}
