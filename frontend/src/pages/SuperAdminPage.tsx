import { FormEvent, useEffect, useState } from 'react';
import { NavLink, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ZBadge, ZButton, ZCard, ZInput } from '../components/ui';
import { ApiError } from '../api/client';
import { v12Api } from '../api/v12';
import { useAuthStore } from '../store/authStore';

function OverviewView() {
  const { t } = useTranslation();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void v12Api
      .superOverview()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'error'));
  }, []);

  if (error) return <p className="text-xs text-zrh-err">{error}</p>;
  if (!data) return <p className="text-xs text-zrh-text-dim">{t('common.loading')}</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-zrh-accent">{t('superadmin.overview')}</h1>
      <div className="grid gap-3 lg:grid-cols-2">
        <ZCard title={t('superadmin.infra')} glow>
          <pre className="max-h-72 overflow-auto text-[10px] text-zrh-text-dim">
            {JSON.stringify(data.infra, null, 2)}
          </pre>
        </ZCard>
        <ZCard title={t('superadmin.reserved')} glow>
          <ul className="space-y-1.5 text-xs">
            {Object.entries((data.reserved as Record<string, boolean>) || {}).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span className="capitalize text-zrh-text">{k}</span>
                <ZBadge tone="dim">{v ? t('common.reserved') : '—'}</ZBadge>
              </li>
            ))}
          </ul>
        </ZCard>
      </div>
    </div>
  );
}

function ConfigsView() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Awaited<ReturnType<typeof v12Api.superConfigs>>['items']>([]);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [group, setGroup] = useState('general');
  const [secret, setSecret] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => void v12Api.superConfigs().then((r) => setItems(r.items));
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await v12Api.superUpsertConfig({ key, value, group, secret });
    setMsg(t('account.saved'));
    setKey('');
    setValue('');
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-zrh-accent">{t('superadmin.configs')}</h1>
      <ZCard title={t('superadmin.upsertConfig')} glow>
        <form onSubmit={(e) => void submit(e)} className="grid gap-3 sm:grid-cols-2">
          <ZInput label="key" value={key} onChange={(e) => setKey(e.target.value)} required />
          <ZInput label="group" value={group} onChange={(e) => setGroup(e.target.value)} />
          <div className="sm:col-span-2">
            <ZInput label="value" value={value} onChange={(e) => setValue(e.target.value)} required />
          </div>
          <label className="flex items-center gap-2 text-xs text-zrh-text-dim">
            <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} />
            secret
          </label>
          <div>
            <ZButton type="submit">{t('common.save')}</ZButton>
          </div>
        </form>
        {msg && <p className="mt-2 text-xs text-zrh-accent">{msg}</p>}
      </ZCard>
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id} className="rounded-lg border border-zrh-border px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-zrh-accent">{c.key}</code>
              <ZBadge tone="dim">{c.group}</ZBadge>
              {c.secret && <ZBadge tone="err">secret</ZBadge>}
            </div>
            <p className="mt-1 text-zrh-text-dim">{c.value}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function JsonView({ title, kind }: { title: string; kind: 'ops' | 'integrations' | 'logs' }) {
  const { t } = useTranslation();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    const run =
      kind === 'ops'
        ? v12Api.superOps()
        : kind === 'integrations'
          ? v12Api.superIntegrations()
          : v12Api.superLogs();
    void run.then(setData).catch(() => setData({ error: true }));
  }, [kind]);
  return (
    <ZCard title={title} glow>
      <p className="mb-2 text-xs text-zrh-text-dim">{t('common.reserved')}</p>
      <pre className="max-h-96 overflow-auto text-[10px] text-zrh-text-dim">
        {JSON.stringify(data, null, 2)}
      </pre>
    </ZCard>
  );
}

/** Super Admin — 仅 SUPER_ADMIN */
export function SuperAdminPage() {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const location = useLocation();

  if (profile?.role !== 'SUPER_ADMIN') {
    return <Navigate to="/" replace />;
  }

  const path = location.pathname;
  const items = [
    { to: '/superadmin', end: true, label: t('superadmin.overview'), match: /^\/superadmin\/?$/ },
    { to: '/superadmin/configs', label: t('superadmin.configs'), match: /^\/superadmin\/configs/ },
    { to: '/superadmin/ops', label: t('superadmin.ops'), match: /^\/superadmin\/ops/ },
    {
      to: '/superadmin/integrations',
      label: t('superadmin.integrations'),
      match: /^\/superadmin\/integrations/,
    },
    { to: '/superadmin/logs', label: t('superadmin.logs'), match: /^\/superadmin\/logs/ },
  ];

  let body = <OverviewView />;
  if (path.startsWith('/superadmin/configs')) body = <ConfigsView />;
  else if (path.startsWith('/superadmin/ops'))
    body = <JsonView title={t('superadmin.ops')} kind="ops" />;
  else if (path.startsWith('/superadmin/integrations'))
    body = <JsonView title={t('superadmin.integrations')} kind="integrations" />;
  else if (path.startsWith('/superadmin/logs'))
    body = <JsonView title={t('superadmin.logs')} kind="logs" />;
  else if (!/^\/superadmin\/?$/.test(path)) body = <Navigate to="/superadmin" replace />;

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <aside className="border-b border-zrh-border bg-zrh-surface/60 lg:w-52 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold tracking-wider text-zrh-accent">{t('superadmin.title')}</p>
          <p className="mt-0.5 text-[10px] text-zrh-text-dim">SUPER_ADMIN</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3 lg:pb-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={() =>
                `whitespace-nowrap rounded-lg px-3 py-2 text-xs transition-colors ${
                  item.match.test(path)
                    ? 'bg-zrh-accent/15 text-zrh-accent font-semibold'
                    : 'text-zrh-text-dim hover:text-zrh-text'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6">{body}</div>
    </div>
  );
}
