import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Wrench, Activity, ScrollText, Sparkles, Route, Shield } from 'lucide-react';
import { ZButton, ZCard, ZInput, ZBadge, ZTabs } from '../components/ui';
import { TechBackground } from '../components/background/TechBackground';
import { fadeInUp, baseTransition } from '../design-system/animations';
import {
  toolsApi,
  ToolCategory,
  ToolDefinition,
  ToolExecuteResult,
  ToolHealth,
  ToolRunLog,
} from '../api/tools';
import { useAuthStore } from '../store/authStore';

export function ToolsPage() {
  const { t } = useTranslation();
  const canExecute = useAuthStore((s) => s.hasPermission('api:tools:execute'));
  const canAdmin = useAuthStore((s) => s.hasPermission('api:tools:admin'));

  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [categories, setCategories] = useState<ToolCategory[]>([]);
  const [health, setHealth] = useState<ToolHealth | null>(null);
  const [selected, setSelected] = useState('calculator');
  const [task, setTask] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ToolExecuteResult | null>(null);
  const [routeHint, setRouteHint] = useState('');
  const [logs, setLogs] = useState<ToolRunLog[]>([]);
  const [permissions, setPermissions] = useState<
    Array<{ code: string; name: string; enabled: boolean; roleAccess: string | null; requiredPermission: string }>
  >([]);

  const selectedTool = useMemo(
    () => tools.find((x) => x.code === selected) ?? null,
    [tools, selected],
  );

  const load = async () => {
    setError(null);
    try {
      const [list, cats, h, perms] = await Promise.all([
        toolsApi.list(),
        toolsApi.categories(),
        toolsApi.health(),
        toolsApi.permissions(),
      ]);
      setTools(list);
      setCategories(cats);
      setHealth(h);
      setPermissions(perms);
      if (!list.find((x) => x.code === selected) && list[0]) setSelected(list[0].code);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const runCall = async () => {
    if (!task.trim() || !canExecute) return;
    setLoading(true);
    setError(null);
    try {
      const routed = await toolsApi.route(task.trim());
      setRouteHint(`${routed.toolCode} (${routed.reason})`);
      const out = await toolsApi.call({
        message: task.trim(),
        toolCode: selected || routed.toolCode,
      });
      setResult(out.result);
      setRouteHint(`${out.plan.toolCode} · ${out.plan.reason}${out.llmAssisted ? ' · LLM' : ''}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const runDirect = async () => {
    if (!selectedTool || !canExecute) return;
    setLoading(true);
    setError(null);
    try {
      const routed = await toolsApi.route(task.trim() || selectedTool.code, undefined);
      const out = await toolsApi.execute({
        toolCode: selectedTool.code,
        args: routed.args,
        mode: 'sync',
      });
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (tool: ToolDefinition) => {
    if (!canAdmin) return;
    try {
      if (tool.enabled) await toolsApi.disable(tool.code);
      else await toolsApi.enable(tool.code);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const loadLogs = async () => {
    if (!canAdmin) return;
    try {
      const data = await toolsApi.logs(1, 30);
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
          <Wrench className="h-4 w-4" /> {t('tools.registry')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <ZBadge key={c.code} tone="dim">
                {c.name} ({c.toolCount ?? 0})
              </ZBadge>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <button
                key={tool.code}
                type="button"
                onClick={() => setSelected(tool.code)}
                className={`rounded-lg border p-3 text-left transition ${
                  selected === tool.code
                    ? 'border-zrh-accent bg-zrh-surface-raised'
                    : 'border-zrh-border bg-zrh-surface-raised/40 hover:border-zrh-accent/40'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zrh-text">{tool.name}</span>
                  <ZBadge tone={tool.enabled ? 'ok' : 'dim'}>
                    {tool.enabled ? t('tools.enabled') : t('tools.disabled')}
                  </ZBadge>
                </div>
                <p className="mb-2 line-clamp-2 text-xs text-zrh-text-dim">{tool.description}</p>
                <div className="flex flex-wrap gap-1">
                  <ZBadge tone="accent">{tool.categoryCode}</ZBadge>
                  {tool.builtin && <ZBadge tone="dim">builtin</ZBadge>}
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-zrh-text-dim">
                  <span>v{tool.version}</span>
                  {canAdmin && (
                    <ZButton
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggle(tool);
                      }}
                    >
                      {tool.enabled ? t('tools.disable') : t('tools.enable')}
                    </ZButton>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'execute',
      label: (
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4" /> {t('tools.execute')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-4">
          {selectedTool && (
            <p className="text-xs text-zrh-text-dim">
              {t('tools.activeTool')}: <span className="text-zrh-text">{selectedTool.name}</span>
              {routeHint ? ` · ${t('tools.router')}: ${routeHint}` : ''}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <ZInput
              className="flex-1"
              placeholder={t('tools.taskPlaceholder')}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void runCall()}
            />
            <ZButton loading={loading} disabled={!canExecute || !task.trim()} onClick={() => void runCall()}>
              {t('tools.call')}
            </ZButton>
            <ZButton
              loading={loading}
              variant="secondary"
              disabled={!canExecute || !selectedTool}
              onClick={() => void runDirect()}
            >
              {t('tools.runDirect')}
            </ZButton>
          </div>
          {result && (
            <div className="rounded-lg border border-zrh-border bg-zrh-surface-raised/40 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zrh-text-dim">
                <ZBadge tone="accent">{result.toolCode}</ZBadge>
                <ZBadge tone={result.status === 'success' ? 'ok' : 'err'}>{result.status}</ZBadge>
                <span>{result.latencyMs} ms</span>
              </div>
              {result.error && <p className="mb-2 text-sm text-red-400">{result.error}</p>}
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs text-zrh-text">
                {JSON.stringify(result.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'router',
      label: (
        <span className="flex items-center gap-1.5">
          <Route className="h-4 w-4" /> {t('tools.router')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zrh-text-dim">{t('tools.routerHint')}</p>
          <ZButton
            size="sm"
            variant="secondary"
            disabled={!task.trim()}
            onClick={async () => {
              try {
                const r = await toolsApi.route(task.trim());
                setRouteHint(`${r.toolCode} (${r.reason})`);
                setSelected(r.toolCode);
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            {t('tools.previewRoute')}
          </ZButton>
          {routeHint && <p className="text-sm text-zrh-text">{routeHint}</p>}
        </div>
      ),
    },
    {
      key: 'permissions',
      label: (
        <span className="flex items-center gap-1.5">
          <Shield className="h-4 w-4" /> {t('tools.permissions')}
        </span>
      ),
      content: (
        <div className="space-y-2">
          {permissions.map((p) => (
            <div key={p.code} className="rounded-lg border border-zrh-border p-3 text-xs">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-medium text-zrh-text">{p.name}</span>
                <ZBadge tone={p.enabled ? 'ok' : 'dim'}>{p.code}</ZBadge>
              </div>
              <p className="text-zrh-text-dim">
                {p.requiredPermission}
                {p.roleAccess ? ` · roles: ${p.roleAccess}` : ` · ${t('tools.allRoles')}`}
              </p>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'logs',
      label: (
        <span className="flex items-center gap-1.5">
          <ScrollText className="h-4 w-4" /> {t('tools.logs')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-3">
          {canAdmin ? (
            <ZButton size="sm" variant="secondary" onClick={() => void loadLogs()}>
              {t('tools.refreshLogs')}
            </ZButton>
          ) : (
            <p className="text-sm text-zrh-text-dim">{t('tools.logsAdminOnly')}</p>
          )}
          {logs.map((l) => (
            <div key={l.id} className="rounded-lg border border-zrh-border p-3 text-xs">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-medium text-zrh-text">{l.tool.name}</span>
                <ZBadge tone={l.status === 'success' ? 'ok' : 'err'}>{l.status}</ZBadge>
                <span className="text-zrh-text-dim">{l.latencyMs} ms</span>
              </div>
              {l.error && <p className="text-red-400">{l.error}</p>}
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
            <Wrench className="h-6 w-6 text-zrh-accent" />
            <h1 className="text-lg font-bold tracking-wider text-zrh-accent">{t('tools.title')}</h1>
          </div>
          <p className="mt-1 text-xs text-zrh-text-dim sm:text-sm">{t('tools.subtitle')}</p>
        </motion.div>

        {health && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-zrh-text-dim">
            <Activity className="h-3.5 w-3.5 text-zrh-accent" />
            <ZBadge tone={health.ok ? 'ok' : 'err'}>Health</ZBadge>
            <span>
              {t('tools.enabled')}: {health.tools.enabled}/{health.tools.total}
            </span>
            <span>
              {t('tools.categories')}: {health.categories.total}
            </span>
            <span>
              {t('tools.errors24h')}: {health.logs.errors24h}
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
