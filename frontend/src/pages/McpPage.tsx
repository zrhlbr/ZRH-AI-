import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Cable, Activity, ScrollText, Plug, Unplug } from 'lucide-react';
import { ZButton, ZCard, ZBadge, ZTabs } from '../components/ui';
import { TechBackground } from '../components/background/TechBackground';
import { fadeInUp, baseTransition } from '../design-system/animations';
import { BrandMark } from '../design-system/BrandMark';
import { mcpApi, McpHealth, McpRunLog, McpServer, McpSession } from '../api/mcp';
import { useAuthStore } from '../store/authStore';

export function McpPage() {
  const { t } = useTranslation();
  const canWrite = useAuthStore((s) => s.hasPermission('api:mcp:write'));
  const canAdmin = useAuthStore((s) => s.hasPermission('api:mcp:admin'));

  const [servers, setServers] = useState<McpServer[]>([]);
  const [sessions, setSessions] = useState<McpSession[]>([]);
  const [health, setHealth] = useState<McpHealth | null>(null);
  const [logs, setLogs] = useState<McpRunLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [s, sess, h] = await Promise.all([mcpApi.servers(), mcpApi.sessions(), mcpApi.health()]);
      setServers(s);
      setSessions(sess);
      setHealth(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggle = async (server: McpServer) => {
    if (!canAdmin) return;
    setBusy(server.code);
    try {
      if (server.enabled) await mcpApi.disable(server.code);
      else await mcpApi.enable(server.code);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const connect = async (code: string) => {
    if (!canWrite) return;
    setBusy(code);
    try {
      await mcpApi.connect(code);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (session: McpSession) => {
    if (!canWrite) return;
    setBusy(String(session.id));
    try {
      await mcpApi.disconnect({ sessionId: session.id });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const loadLogs = async () => {
    if (!canAdmin) return;
    try {
      const data = await mcpApi.logs(1, 30);
      setLogs(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const tabs = [
    {
      key: 'registry',
      label: (
        <span className="flex items-center gap-1.5">
          <Cable className="h-4 w-4" /> {t('mcp.registry')}
        </span>
      ),
      content: (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((s) => (
            <div key={s.code} className="rounded-lg border border-zrh-border bg-zrh-surface-raised/40 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-zrh-text">{s.name}</span>
                <ZBadge tone={s.enabled ? 'ok' : s.reserved ? 'warn' : 'dim'}>
                  {s.reserved ? t('mcp.reserved') : s.enabled ? t('mcp.enabled') : t('mcp.disabled')}
                </ZBadge>
              </div>
              <p className="mb-2 line-clamp-2 text-xs text-zrh-text-dim">{s.description}</p>
              <div className="mb-3 flex flex-wrap gap-1">
                <ZBadge tone="accent">{s.transport}</ZBadge>
                <ZBadge tone="dim">{s.status}</ZBadge>
                <ZBadge tone="dim">v{s.version}</ZBadge>
              </div>
              <div className="flex flex-wrap gap-2">
                {canAdmin && (
                  <ZButton size="sm" variant="ghost" loading={busy === s.code} onClick={() => void toggle(s)}>
                    {s.enabled ? t('mcp.disable') : t('mcp.enable')}
                  </ZButton>
                )}
                {canWrite && (
                  <ZButton
                    size="sm"
                    variant="secondary"
                    loading={busy === s.code}
                    disabled={!s.enabled}
                    onClick={() => void connect(s.code)}
                  >
                    <Plug className="h-3.5 w-3.5" />
                    {t('mcp.connect')}
                  </ZButton>
                )}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'sessions',
      label: (
        <span className="flex items-center gap-1.5">
          <Plug className="h-4 w-4" /> {t('mcp.sessions')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-2">
          {sessions.length === 0 && <p className="text-sm text-zrh-text-dim">{t('mcp.noSessions')}</p>}
          {sessions.map((sess) => (
            <div key={sess.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zrh-border p-3">
              <div className="text-xs">
                <p className="font-medium text-zrh-text">
                  {sess.serverName} ({sess.serverCode})
                </p>
                <p className="text-zrh-text-dim">
                  #{sess.id} · {sess.status} · {new Date(sess.startedAt).toLocaleString()}
                </p>
              </div>
              {canWrite && (
                <ZButton size="sm" variant="ghost" loading={busy === String(sess.id)} onClick={() => void disconnect(sess)}>
                  <Unplug className="h-3.5 w-3.5" />
                  {t('mcp.disconnect')}
                </ZButton>
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'logs',
      label: (
        <span className="flex items-center gap-1.5">
          <ScrollText className="h-4 w-4" /> {t('mcp.logs')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-3">
          {canAdmin ? (
            <ZButton size="sm" variant="secondary" onClick={() => void loadLogs()}>
              {t('mcp.refreshLogs')}
            </ZButton>
          ) : (
            <p className="text-sm text-zrh-text-dim">{t('mcp.logsAdminOnly')}</p>
          )}
          {logs.map((l) => (
            <div key={l.id} className="rounded-lg border border-zrh-border p-3 text-xs">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-medium text-zrh-text">{l.server.name}</span>
                <ZBadge tone="accent">{l.action}</ZBadge>
                <ZBadge tone={l.status === 'success' ? 'ok' : 'err'}>{l.status}</ZBadge>
                <span className="text-zrh-text-dim">{l.latencyMs} ms</span>
              </div>
              {l.detail && <p className="text-zrh-text-dim">{l.detail}</p>}
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <TechBackground>
      <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 px-3 py-5 sm:px-5">
        <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={baseTransition}>
          <div className="flex items-center gap-3">
            <BrandMark size={32} className="h-8 w-8 rounded-lg" />
            <h1 className="text-lg font-bold tracking-wider text-zrh-accent">{t('mcp.title')}</h1>
          </div>
          <p className="mt-1 text-xs text-zrh-text-dim sm:text-sm">{t('mcp.subtitle')}</p>
        </motion.div>

        {health && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-zrh-text-dim">
            <Activity className="h-3.5 w-3.5 text-zrh-accent" />
            <ZBadge tone={health.ok ? 'ok' : 'err'}>Health</ZBadge>
            <span>
              {t('mcp.servers')}: {health.servers.total} ({t('mcp.reserved')}: {health.servers.reserved})
            </span>
            <span>
              {t('mcp.sessions')}: {health.sessions.active}
            </span>
            <span>
              {t('mcp.errors24h')}: {health.logs.errors24h}
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <ZCard className="flex-1">
          <ZTabs tabs={tabs} defaultKey="registry" />
        </ZCard>
      </div>
    </TechBackground>
  );
}
