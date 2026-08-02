import { FormEvent, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ZBadge, ZButton, ZCard, ZEmpty, ZInput, ZSkeleton } from '../components/ui';
import { ApiError } from '../api/client';
import { AdminDashboard, v12Api } from '../api/v12';
import { useAuthStore } from '../store/authStore';
import { brand } from '../design-system/theme';
import { BrandMark } from '../design-system/BrandMark';

function DashboardView() {
  const { t } = useTranslation();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void v12Api
      .adminDashboard()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'error'));
  }, []);

  if (error) {
    return (
      <ZEmpty title={t('common.error')} description={error} action={<ZButton size="sm" onClick={() => window.location.reload()}>{t('common.retry')}</ZButton>} />
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <ZSkeleton className="h-7 w-40" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ZSkeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    { label: t('admin.usersToday'), value: data.users.today },
    { label: t('admin.usersTotal'), value: data.users.total },
    { label: t('admin.online'), value: data.users.onlineSessions },
    { label: t('admin.aiRequests'), value: data.ai.requestsToday },
    { label: t('admin.tokens'), value: data.ai.tokensToday },
    { label: t('admin.announcements'), value: data.announcements },
  ];

  const infra = (data.infra || {}) as Record<string, unknown>;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <BrandMark size={48} className="mt-0.5 h-12 w-12 shrink-0 rounded-xl" />
        <div>
          <h1 className="font-display text-lg font-semibold tracking-wide text-zrh-accent">{t('admin.dashboard')}</h1>
          <p className="mt-1 text-xs text-zrh-text-dim">
            {brand.name} · {brand.subtitle}
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <ZCard key={c.label} padded className="!p-4" glow>
            <p className="text-[11px] uppercase tracking-wider text-zrh-text-dim">{c.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold text-zrh-text">{c.value}</p>
          </ZCard>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <ZCard title={t('admin.monitor')} glow>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {['cpu', 'memory', 'gpu', 'docker', 'redis', 'postgres'].map((key) => {
              const val = infra[key];
              const text =
                val == null
                  ? '—'
                  : typeof val === 'object'
                    ? JSON.stringify(val)
                    : String(val);
              return (
                <div key={key} className="rounded-lg border border-zrh-border/80 bg-zrh-bg/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-zrh-text-dim">{key}</p>
                  <p className="mt-1 truncate text-zrh-text" title={text}>
                    {text}
                  </p>
                </div>
              );
            })}
          </div>
        </ZCard>
        <ZCard title={t('admin.modules')} glow>
          <ul className="space-y-1.5 text-xs">
            {Object.entries(data.modules).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between rounded-md px-1 py-1 hover:bg-zrh-surface-raised">
                <span className="capitalize text-zrh-text">{k}</span>
                <ZBadge tone={v ? 'ok' : 'dim'}>{v ? t('common.on') : t('common.off')}</ZBadge>
              </li>
            ))}
          </ul>
        </ZCard>
      </div>
    </div>
  );
}

function UsersView() {
  const { t } = useTranslation();
  const { hasPermission } = useAuthStore();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Awaited<ReturnType<typeof v12Api.adminUsers>>['items']>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async (query?: string) => {
    const [users, roleList] = await Promise.all([v12Api.adminUsers(query), v12Api.adminRoles()]);
    setItems(users.items);
    setRoles(roleList.items.map((r) => r.code));
  };

  useEffect(() => {
    void load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-zrh-accent">{t('admin.users')}</h1>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load(q.trim() || undefined);
        }}
      >
        <ZInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.searchUsers')} />
        <ZButton type="submit">{t('common.search')}</ZButton>
      </form>
      {msg && <p className="text-xs text-zrh-accent">{msg}</p>}
      <div className="overflow-x-auto rounded-xl border border-zrh-border">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-zrh-surface text-zrh-text-dim">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">{t('auth.username')}</th>
              <th className="px-3 py-2">{t('auth.email')}</th>
              <th className="px-3 py-2">{t('admin.role')}</th>
              <th className="px-3 py-2">{t('admin.status')}</th>
              <th className="px-3 py-2">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-t border-zrh-border">
                <td className="px-3 py-2">{u.id}</td>
                <td className="px-3 py-2 text-zrh-text">{u.username}</td>
                <td className="px-3 py-2 text-zrh-text-dim">{u.email || '—'}</td>
                <td className="px-3 py-2">
                  {hasPermission('api:users:admin') ? (
                    <select
                      className="rounded border border-zrh-border bg-zrh-surface px-2 py-1"
                      value={u.role}
                      onChange={(e) =>
                        void v12Api.adminSetUserRole(u.id, e.target.value).then(() => load(q || undefined))
                      }
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    u.role
                  )}
                </td>
                <td className="px-3 py-2">
                  <ZBadge tone={u.status === 'active' ? 'ok' : 'err'}>{u.status}</ZBadge>
                </td>
                <td className="px-3 py-2">
                  {hasPermission('api:users:admin') && (
                    <div className="flex flex-wrap gap-1">
                      <ZButton
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void v12Api
                            .adminSetUserStatus(u.id, u.status === 'active' ? 'disabled' : 'active')
                            .then(() => load(q || undefined))
                        }
                      >
                        {u.status === 'active' ? t('admin.disable') : t('admin.enable')}
                      </ZButton>
                      <ZButton
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const pwd = window.prompt(t('auth.newPassword'));
                          if (!pwd || pwd.length < 8) return;
                          void v12Api.adminResetPassword(u.id, pwd).then(() => setMsg(t('admin.resetOk')));
                        }}
                      >
                        {t('admin.resetPwd')}
                      </ZButton>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RolesView() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Awaited<ReturnType<typeof v12Api.adminRoles>>['items']>([]);
  useEffect(() => {
    void v12Api.adminRoles().then((r) => setItems(r.items));
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-zrh-accent">{t('admin.roles')}</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => (
          <ZCard key={r.id} title={r.code} glow>
            <p className="text-sm text-zrh-text">{r.name}</p>
            <p className="mt-2 text-xs text-zrh-text-dim">
              {t('admin.users')}: {r.users} · {t('admin.permissions')}: {r.permissions}
            </p>
          </ZCard>
        ))}
      </div>
    </div>
  );
}

function PermissionsView() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Awaited<ReturnType<typeof v12Api.adminPermissions>>['items']>([]);
  useEffect(() => {
    void v12Api.adminPermissions().then((r) => setItems(r.items));
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-zrh-accent">{t('admin.permissions')}</h1>
      <ul className="max-h-[70vh] space-y-1 overflow-auto rounded-xl border border-zrh-border p-3 text-xs">
        {items.map((p) => (
          <li key={p.id} className="flex justify-between gap-2 border-b border-zrh-border/50 py-1.5">
            <code className="text-zrh-accent">{p.code}</code>
            <span className="text-zrh-text-dim">{p.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnnouncementsView() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [published, setPublished] = useState(true);

  const load = () => void v12Api.adminAnnouncements().then((r) => setItems(r.items));
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await v12Api.adminUpsertAnnouncement({ title, body, published, locale: 'zh-CN' });
    setTitle('');
    setBody('');
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-zrh-accent">{t('admin.announcements')}</h1>
      <ZCard title={t('admin.createAnnouncement')} glow>
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
          <ZInput label={t('admin.annTitle')} value={title} onChange={(e) => setTitle(e.target.value)} required />
          <label className="flex flex-col gap-1.5 text-xs text-zrh-text-dim">
            {t('admin.annBody')}
            <textarea
              className="min-h-24 rounded-lg border border-zrh-border bg-zrh-surface px-3 py-2 text-sm text-zrh-text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-zrh-text-dim">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            {t('admin.publish')}
          </label>
          <ZButton type="submit">{t('common.save')}</ZButton>
        </form>
      </ZCard>
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={String(a.id)} className="rounded-lg border border-zrh-border px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-zrh-text">{String(a.title)}</span>
              <ZBadge tone={a.published ? 'ok' : 'dim'}>
                {a.published ? t('admin.published') : t('admin.draft')}
              </ZBadge>
            </div>
            <p className="mt-1 text-zrh-text-dim">{String(a.body)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Enterprise module console — links to live product pages (no placeholder demos) */
function ModuleHubView({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold tracking-wide text-zrh-accent">{title}</h1>
      <ZCard glow hud>
        <p className="text-sm text-zrh-text">{description}</p>
        <div className="mt-4">
          <Link to={href}>
            <ZButton size="sm">{cta}</ZButton>
          </Link>
        </div>
      </ZCard>
    </div>
  );
}

function LogsView() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-lg font-semibold text-zrh-accent">{t('admin.logs')}</h1>
      <ZCard title={t('admin.auditTrail')} glow>
        <p className="text-xs leading-relaxed text-zrh-text-dim">{t('admin.logsHint')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/account">
            <ZButton size="sm" variant="secondary">
              {t('nav.account')}
            </ZButton>
          </Link>
          <Link to="/status">
            <ZButton size="sm" variant="ghost">
              {t('nav.status')}
            </ZButton>
          </Link>
        </div>
      </ZCard>
    </div>
  );
}

/** Admin 后台 — 路径分区渲染，不改动 V1.1 业务模块 */
export function AdminPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuthStore();
  const location = useLocation();

  if (!hasPermission('menu:admin') && !hasPermission('api:admin:read')) {
    return <Navigate to="/home" replace />;
  }

  const items = [
    { to: '/admin', end: true, label: t('admin.dashboard'), match: /^\/admin\/?$/ },
    { to: '/admin/users', label: t('admin.users'), match: /^\/admin\/users/ },
    { to: '/admin/roles', label: t('admin.roles'), match: /^\/admin\/roles/ },
    { to: '/admin/permissions', label: t('admin.permissions'), match: /^\/admin\/permissions/ },
    { to: '/admin/knowledge', label: t('admin.knowledge'), match: /^\/admin\/knowledge/ },
    { to: '/admin/models', label: t('admin.models'), match: /^\/admin\/models/ },
    { to: '/admin/agents', label: t('admin.agents'), match: /^\/admin\/agents/ },
    { to: '/admin/workflows', label: t('admin.workflows'), match: /^\/admin\/workflows/ },
    { to: '/admin/mcp', label: t('admin.mcp'), match: /^\/admin\/mcp/ },
    { to: '/admin/business', label: t('admin.business'), match: /^\/admin\/business/ },
    { to: '/admin/logs', label: t('admin.logs'), match: /^\/admin\/logs/ },
    { to: '/admin/monitor', label: t('admin.monitor'), match: /^\/admin\/monitor/ },
    { to: '/admin/settings', label: t('admin.settings'), match: /^\/admin\/settings/ },
    { to: '/admin/seo', label: t('admin.seo'), match: /^\/admin\/seo/ },
    { to: '/admin/i18n', label: t('admin.i18n'), match: /^\/admin\/i18n/ },
    { to: '/admin/announcements', label: t('admin.announcements'), match: /^\/admin\/announcements/ },
  ];

  const path = location.pathname;
  let body = <DashboardView />;
  if (path.startsWith('/admin/users')) body = <UsersView />;
  else if (path.startsWith('/admin/roles')) body = <RolesView />;
  else if (path.startsWith('/admin/permissions')) body = <PermissionsView />;
  else if (path.startsWith('/admin/announcements')) body = <AnnouncementsView />;
  else if (path.startsWith('/admin/knowledge'))
    body = (
      <ModuleHubView
        title={t('admin.knowledge')}
        description={t('admin.hubKnowledge')}
        href="/knowledge"
        cta={t('admin.openModule')}
      />
    );
  else if (path.startsWith('/admin/models'))
    body = (
      <ModuleHubView
        title={t('admin.models')}
        description={t('admin.hubModels')}
        href="/ai/models"
        cta={t('admin.openModule')}
      />
    );
  else if (path.startsWith('/admin/agents'))
    body = (
      <ModuleHubView title={t('admin.agents')} description={t('admin.hubAgents')} href="/agents" cta={t('admin.openModule')} />
    );
  else if (path.startsWith('/admin/workflows'))
    body = (
      <ModuleHubView
        title={t('admin.workflows')}
        description={t('admin.hubWorkflows')}
        href="/workflows"
        cta={t('admin.openModule')}
      />
    );
  else if (path.startsWith('/admin/mcp'))
    body = (
      <ModuleHubView title={t('admin.mcp')} description={t('admin.hubMcp')} href="/mcp" cta={t('admin.openModule')} />
    );
  else if (path.startsWith('/admin/business'))
    body = (
      <ModuleHubView
        title={t('admin.business')}
        description={t('admin.hubBusiness')}
        href="/business"
        cta={t('admin.openModule')}
      />
    );
  else if (path.startsWith('/admin/logs')) body = <LogsView />;
  else if (path.startsWith('/admin/monitor'))
    body = (
      <ModuleHubView
        title={t('admin.monitor')}
        description={t('admin.hubMonitor')}
        href="/status"
        cta={t('admin.openModule')}
      />
    );
  else if (path.startsWith('/admin/settings'))
    body = (
      <ModuleHubView
        title={t('admin.settings')}
        description={t('admin.hubSettings')}
        href="/superadmin/configs"
        cta={t('admin.openModule')}
      />
    );
  else if (path.startsWith('/admin/seo'))
    body = (
      <ModuleHubView title={t('admin.seo')} description={t('admin.hubSeo')} href="/admin" cta={t('admin.backDashboard')} />
    );
  else if (path.startsWith('/admin/i18n'))
    body = (
      <ModuleHubView title={t('admin.i18n')} description={t('admin.hubI18n')} href="/admin" cta={t('admin.backDashboard')} />
    );
  else if (!/^\/admin\/?$/.test(path)) body = <Navigate to="/admin" replace />;

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <aside className="border-b border-zrh-border bg-zrh-surface/60 lg:w-52 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold tracking-wider text-zrh-accent">{t('admin.title')}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-4">
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
