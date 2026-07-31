import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Building2,
  Activity,
  ScrollText,
  Play,
  Plug,
  GitBranch,
} from 'lucide-react';
import { ZButton, ZCard, ZBadge, ZTabs } from '../components/ui';
import { TechBackground } from '../components/background/TechBackground';
import { fadeInUp, baseTransition } from '../design-system/animations';
import {
  businessApi,
  BusinessHealth,
  BusinessInvokeResult,
  BusinessSystem,
} from '../api/business';
import { useAuthStore } from '../store/authStore';

export function BusinessPage() {
  const { t } = useTranslation();
  const canExecute = useAuthStore((s) => s.hasPermission('api:business:execute'));
  const canAdmin = useAuthStore((s) => s.hasPermission('api:business:admin'));

  const [systems, setSystems] = useState<BusinessSystem[]>([]);
  const [health, setHealth] = useState<BusinessHealth | null>(null);
  const [selected, setSelected] = useState('zrh_accounting');
  const [action, setAction] = useState('balance_query');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BusinessInvokeResult | null>(null);
  const [logs, setLogs] = useState<
    Array<{
      id: number;
      action: string;
      status: string;
      workflowCode: string | null;
      detail: string | null;
      createdAt: string;
      system: { code: string; name: string };
    }>
  >([]);

  const selectedSys = useMemo(
    () => systems.find((s) => s.code === selected) ?? null,
    [systems, selected],
  );

  const load = async () => {
    setError(null);
    try {
      const [list, h] = await Promise.all([businessApi.systems(), businessApi.health()]);
      setSystems(list);
      setHealth(h);
      if (!list.find((x) => x.code === selected) && list[0]) setSelected(list[0].code);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedSys) return;
    const def = selectedSys.workflows.find((w) => w.isDefault) ?? selectedSys.workflows[0];
    if (def) setAction(def.actionCode);
  }, [selectedSys?.code]);

  const invoke = async () => {
    if (!canExecute || !selected) return;
    setLoading(true);
    setError(null);
    try {
      const input =
        action === 'qa' || action === 'search'
          ? { query: '企业制度与财务概况' }
          : action === 'manage'
            ? { content: '# 制度文档示例' }
            : {};
      const out = await businessApi.invoke({ systemCode: selected, action, input });
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    if (!canAdmin) return;
    try {
      const data = await businessApi.logs(1, 30);
      setLogs(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const tabs = [
    {
      key: 'overview',
      label: (
        <span className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4" /> {t('business.overview')}
        </span>
      ),
      content: (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {systems.map((sys) => (
            <button
              key={sys.code}
              type="button"
              onClick={() => setSelected(sys.code)}
              className={`rounded-lg border p-3 text-left transition ${
                selected === sys.code
                  ? 'border-zrh-accent bg-zrh-surface-raised'
                  : 'border-zrh-border bg-zrh-surface-raised/40 hover:border-zrh-accent/40'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-zrh-text">{sys.name}</span>
                <ZBadge tone={sys.enabled ? 'ok' : 'dim'}>{sys.status}</ZBadge>
              </div>
              <p className="mb-2 line-clamp-2 text-xs text-zrh-text-dim">{sys.description}</p>
              <div className="flex flex-wrap gap-1">
                <ZBadge tone="accent">{sys.kind}</ZBadge>
                {sys.readOnlyDefault && <ZBadge tone="dim">read-only</ZBadge>}
                {sys.writeRequiresApproval && <ZBadge tone="warn">approval</ZBadge>}
              </div>
              <p className="mt-2 text-[11px] text-zrh-text-dim">
                {t('business.connectors')}: {sys.connectors.length} · {t('business.workflows')}:{' '}
                {sys.workflows.length}
              </p>
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'invoke',
      label: (
        <span className="flex items-center gap-1.5">
          <Play className="h-4 w-4" /> {t('business.invoke')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-4">
          {selectedSys && (
            <p className="text-xs text-zrh-text-dim">
              {t('business.active')}: <span className="text-zrh-text">{selectedSys.name}</span>
            </p>
          )}
          <select
            className="rounded-lg border border-zrh-border bg-zrh-surface px-3 py-2 text-sm text-zrh-text"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            {(selectedSys?.workflows ?? []).map((w) => (
              <option key={w.actionCode} value={w.actionCode}>
                {w.name} ({w.workflowCode}){w.requiresApproval ? ' [approval]' : ''}
              </option>
            ))}
          </select>
          <ZButton loading={loading} disabled={!canExecute} onClick={() => void invoke()}>
            <Play className="h-4 w-4" />
            {t('business.runViaWorkflow')}
          </ZButton>
          <p className="text-[11px] text-zrh-text-dim">{t('business.archHint')}</p>
          {result && (
            <div className="rounded-lg border border-zrh-border p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <ZBadge tone={result.workflowStatus === 'success' ? 'ok' : 'warn'}>
                  {result.workflowStatus}
                </ZBadge>
                <ZBadge tone="accent">{result.workflowCode}</ZBadge>
                <span className="text-zrh-text-dim">run #{result.workflowRunId}</span>
              </div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs text-zrh-text">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'connectors',
      label: (
        <span className="flex items-center gap-1.5">
          <Plug className="h-4 w-4" /> {t('business.connectors')}
        </span>
      ),
      content: (
        <div className="space-y-2">
          {systems.flatMap((sys) =>
            sys.connectors.map((c) => (
              <div key={`${sys.code}-${c.code}`} className="rounded-lg border border-zrh-border p-3 text-xs">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zrh-text">{c.name}</span>
                  <ZBadge tone="accent">{sys.code}</ZBadge>
                  <ZBadge tone={c.healthStatus === 'healthy' ? 'ok' : 'dim'}>{c.healthStatus}</ZBadge>
                </div>
                <p className="text-zrh-text-dim">
                  {c.transport} · {c.status}
                </p>
              </div>
            )),
          )}
        </div>
      ),
    },
    {
      key: 'workflows',
      label: (
        <span className="flex items-center gap-1.5">
          <GitBranch className="h-4 w-4" /> {t('business.workflows')}
        </span>
      ),
      content: (
        <div className="space-y-2">
          {systems.flatMap((sys) =>
            sys.workflows.map((w) => (
              <div key={`${sys.code}-${w.actionCode}`} className="rounded-lg border border-zrh-border p-3 text-xs">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zrh-text">{w.name}</span>
                  <ZBadge tone="accent">{sys.code}</ZBadge>
                  {w.readOnly ? <ZBadge tone="ok">read-only</ZBadge> : <ZBadge tone="warn">approval</ZBadge>}
                </div>
                <p className="text-zrh-text-dim">
                  {w.actionCode} → {w.workflowCode}
                </p>
              </div>
            )),
          )}
        </div>
      ),
    },
    {
      key: 'logs',
      label: (
        <span className="flex items-center gap-1.5">
          <ScrollText className="h-4 w-4" /> {t('business.audit')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-3">
          {canAdmin ? (
            <ZButton size="sm" variant="secondary" onClick={() => void loadLogs()}>
              {t('business.refreshLogs')}
            </ZButton>
          ) : (
            <p className="text-sm text-zrh-text-dim">{t('business.logsAdminOnly')}</p>
          )}
          {logs.map((l) => (
            <div key={l.id} className="rounded-lg border border-zrh-border p-3 text-xs">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-medium text-zrh-text">{l.system.name}</span>
                <ZBadge tone="accent">{l.action}</ZBadge>
                <ZBadge tone={l.status === 'success' ? 'ok' : 'warn'}>{l.status}</ZBadge>
              </div>
              <p className="text-zrh-text-dim">
                {l.workflowCode} · {new Date(l.createdAt).toLocaleString()}
              </p>
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
            <Building2 className="h-6 w-6 text-zrh-accent" />
            <h1 className="text-lg font-bold tracking-wider text-zrh-accent">{t('business.title')}</h1>
          </div>
          <p className="mt-1 text-xs text-zrh-text-dim sm:text-sm">{t('business.subtitle')}</p>
        </motion.div>

        {health && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-zrh-text-dim">
            <Activity className="h-3.5 w-3.5 text-zrh-accent" />
            <ZBadge tone={health.ok ? 'ok' : 'err'}>Health</ZBadge>
            <span>
              {t('business.systems')}: {health.systems.online}/{health.systems.total}
            </span>
            <span>
              {t('business.connectors')}: {health.connectors.healthy}/{health.connectors.enabled}
            </span>
            <span>
              {t('business.audits24h')}: {health.audits24h}
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <ZCard className="flex-1">
          <ZTabs tabs={tabs} defaultKey="overview" />
        </ZCard>
      </div>
    </TechBackground>
  );
}
