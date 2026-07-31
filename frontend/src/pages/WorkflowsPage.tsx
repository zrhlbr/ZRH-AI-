import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Workflow,
  Activity,
  ScrollText,
  Play,
  GitBranch,
  Clock,
  LayoutTemplate,
  Plus,
  ArrowDown,
} from 'lucide-react';
import { ZButton, ZCard, ZInput, ZBadge, ZTabs } from '../components/ui';
import { TechBackground } from '../components/background/TechBackground';
import { fadeInUp, baseTransition } from '../design-system/animations';
import {
  workflowsApi,
  WorkflowDefinition,
  WorkflowGraph,
  WorkflowHealth,
  WorkflowNode,
  WorkflowRun,
} from '../api/workflows';
import { useAuthStore } from '../store/authStore';

const NODE_TYPES = [
  'start',
  'end',
  'agent',
  'tool',
  'mcp',
  'condition',
  'loop',
  'delay',
  'switch',
  'merge',
  'approval',
  'webhook',
] as const;

function linearize(graph: WorkflowGraph): WorkflowNode[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const start = graph.nodes.find((n) => n.type === 'start');
  if (!start) return graph.nodes;
  const ordered: WorkflowNode[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = start.id;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const node = byId.get(cur);
    if (node) ordered.push(node);
    const edge = graph.edges.find((e) => e.from === cur && !e.when) ?? graph.edges.find((e) => e.from === cur);
    cur = edge?.to;
  }
  for (const n of graph.nodes) {
    if (!seen.has(n.id)) ordered.push(n);
  }
  return ordered;
}

export function WorkflowsPage() {
  const { t } = useTranslation();
  const canExecute = useAuthStore((s) => s.hasPermission('api:workflows:execute'));
  const canAdmin = useAuthStore((s) => s.hasPermission('api:workflows:admin'));

  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [health, setHealth] = useState<WorkflowHealth | null>(null);
  const [selected, setSelected] = useState('tpl_toolchain');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [history, setHistory] = useState<Array<WorkflowRun & { workflow: { code: string; name: string } }>>([]);
  const [schedules, setSchedules] = useState<Awaited<ReturnType<typeof workflowsApi.scheduler>>>([]);
  const [logs, setLogs] = useState<
    Array<{ id: number; action: string; detail: string | null; createdAt: string; workflow: { code: string; name: string } }>
  >([]);
  const [draftGraph, setDraftGraph] = useState<WorkflowGraph | null>(null);
  const [inputJson, setInputJson] = useState('{"expression":"1+2*3"}');
  const [addType, setAddType] = useState<string>('tool');

  const selectedWf = useMemo(
    () => workflows.find((w) => w.code === selected) ?? null,
    [workflows, selected],
  );

  const load = async () => {
    setError(null);
    try {
      const [list, h] = await Promise.all([workflowsApi.list(), workflowsApi.health()]);
      setWorkflows(list);
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
    if (selectedWf) {
      setDraftGraph(JSON.parse(JSON.stringify(selectedWf.graph)) as WorkflowGraph);
      const defaults =
        selectedWf.variables && typeof selectedWf.variables === 'object'
          ? ((selectedWf.variables as { defaults?: Record<string, unknown> }).defaults ?? {})
          : {};
      setInputJson(JSON.stringify(defaults, null, 0) || '{}');
    }
  }, [selectedWf?.code]);

  const execute = async () => {
    if (!selected || !canExecute) return;
    setLoading(true);
    setError(null);
    try {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(inputJson || '{}') as Record<string, unknown>;
      } catch {
        throw new Error('invalid input JSON');
      }
      const result = await workflowsApi.execute({ code: selected, input, mode: 'sync' });
      setRun(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (wf: WorkflowDefinition) => {
    if (!canAdmin) return;
    try {
      if (wf.enabled) await workflowsApi.disable(wf.code);
      else await workflowsApi.enable(wf.code);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const saveGraph = async () => {
    if (!selectedWf || !draftGraph || !canAdmin) return;
    setLoading(true);
    try {
      await workflowsApi.update(selectedWf.code, { graph: draftGraph });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const addNode = () => {
    if (!draftGraph) return;
    const id = `n_${Date.now().toString(36)}`;
    const end = draftGraph.nodes.find((n) => n.type === 'end');
    const beforeEnd = draftGraph.edges.find((e) => e.to === end?.id);
    const nodes = [...draftGraph.nodes];
    const edges = draftGraph.edges.filter((e) => e.id !== beforeEnd?.id);
    const config =
      addType === 'tool'
        ? { toolCode: 'calculator', args: { expression: '1+1' } }
        : addType === 'agent'
          ? { agentCode: 'assistant', message: '{{input.message}}' }
          : addType === 'mcp'
            ? { serverCode: 'filesystem', action: 'list', autoEnable: true }
            : {};
    nodes.splice(nodes.length - 1, 0, {
      id,
      type: addType,
      label: `${addType} ${id.slice(-4)}`,
      config,
    });
    const from = beforeEnd?.from ?? 'start';
    edges.push({ id: `e_${from}_${id}`, from, to: id });
    if (end) edges.push({ id: `e_${id}_end`, from: id, to: end.id });
    setDraftGraph({ nodes, edges });
  };

  const removeNode = (nodeId: string) => {
    if (!draftGraph) return;
    const node = draftGraph.nodes.find((n) => n.id === nodeId);
    if (!node || node.type === 'start' || node.type === 'end') return;
    const inEdge = draftGraph.edges.find((e) => e.to === nodeId);
    const outEdge = draftGraph.edges.find((e) => e.from === nodeId && !e.when);
    let edges = draftGraph.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
    if (inEdge && outEdge) {
      edges.push({ id: `e_${inEdge.from}_${outEdge.to}`, from: inEdge.from, to: outEdge.to });
    }
    setDraftGraph({
      nodes: draftGraph.nodes.filter((n) => n.id !== nodeId),
      edges,
    });
  };

  const loadHistory = async () => {
    try {
      const data = await workflowsApi.history(1, 30);
      setHistory(data.items as typeof history);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const loadScheduler = async () => {
    try {
      setSchedules(await workflowsApi.scheduler());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const loadLogs = async () => {
    if (!canAdmin) return;
    try {
      const data = await workflowsApi.logs(1, 30);
      setLogs(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const createIntervalSchedule = async () => {
    if (!selected || !canAdmin) return;
    try {
      await workflowsApi.createSchedule({
        workflowCode: selected,
        name: `${selected} every 10m`,
        kind: 'interval',
        intervalSec: 600,
      });
      await loadScheduler();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const ordered = draftGraph ? linearize(draftGraph) : [];

  const tabs = [
    {
      key: 'registry',
      label: (
        <span className="flex items-center gap-1.5">
          <LayoutTemplate className="h-4 w-4" /> {t('workflows.registry')}
        </span>
      ),
      content: (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((wf) => (
            <button
              key={wf.code}
              type="button"
              onClick={() => setSelected(wf.code)}
              className={`rounded-lg border p-3 text-left transition ${
                selected === wf.code
                  ? 'border-zrh-accent bg-zrh-surface-raised'
                  : 'border-zrh-border bg-zrh-surface-raised/40 hover:border-zrh-accent/40'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-zrh-text">{wf.name}</span>
                <ZBadge tone={wf.enabled ? 'ok' : 'dim'}>
                  {wf.enabled ? t('workflows.enabled') : t('workflows.disabled')}
                </ZBadge>
              </div>
              <p className="mb-2 line-clamp-2 text-xs text-zrh-text-dim">{wf.description}</p>
              <div className="flex flex-wrap gap-1">
                <ZBadge tone="accent">{wf.categoryCode}</ZBadge>
                {wf.template && <ZBadge tone="dim">template</ZBadge>}
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-zrh-text-dim">
                <span>v{wf.version}</span>
                {canAdmin && (
                  <ZButton
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggle(wf);
                    }}
                  >
                    {wf.enabled ? t('workflows.disable') : t('workflows.enable')}
                  </ZButton>
                )}
              </div>
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'designer',
      label: (
        <span className="flex items-center gap-1.5">
          <GitBranch className="h-4 w-4" /> {t('workflows.designer')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-zrh-text-dim">{t('workflows.designerHint')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-zrh-border bg-zrh-surface px-3 py-2 text-sm text-zrh-text"
              value={addType}
              onChange={(e) => setAddType(e.target.value)}
            >
              {NODE_TYPES.filter((x) => x !== 'start' && x !== 'end').map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <ZButton size="sm" variant="secondary" disabled={!canAdmin} onClick={addNode}>
              <Plus className="h-3.5 w-3.5" />
              {t('workflows.addNode')}
            </ZButton>
            <ZButton size="sm" loading={loading} disabled={!canAdmin} onClick={() => void saveGraph()}>
              {t('workflows.saveGraph')}
            </ZButton>
          </div>
          <div className="mx-auto flex w-full max-w-xl flex-col items-stretch gap-1">
            {ordered.map((node, idx) => (
              <div key={node.id} className="flex flex-col items-center">
                {idx > 0 && <ArrowDown className="my-1 h-4 w-4 text-zrh-accent/60" />}
                <div className="w-full rounded-lg border border-zrh-border bg-zrh-surface-raised/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-zrh-text">{node.label}</p>
                      <p className="text-[11px] text-zrh-text-dim">
                        {node.type} · {node.id}
                      </p>
                    </div>
                    {node.type !== 'start' && node.type !== 'end' && canAdmin && (
                      <ZButton size="sm" variant="ghost" onClick={() => removeNode(node.id)}>
                        {t('workflows.remove')}
                      </ZButton>
                    )}
                  </div>
                  {!!node.config && Object.keys(node.config).length > 0 && (
                    <pre className="mt-2 max-h-24 overflow-auto text-[11px] text-zrh-text-dim">
                      {JSON.stringify(node.config)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'execute',
      label: (
        <span className="flex items-center gap-1.5">
          <Play className="h-4 w-4" /> {t('workflows.execution')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-4">
          {selectedWf && (
            <p className="text-xs text-zrh-text-dim">
              {t('workflows.active')}: <span className="text-zrh-text">{selectedWf.name}</span>
            </p>
          )}
          <ZInput
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            placeholder='{"query":"..."}'
          />
          <ZButton loading={loading} disabled={!canExecute} onClick={() => void execute()}>
            <Play className="h-4 w-4" />
            {t('workflows.run')}
          </ZButton>
          {run && (
            <div className="rounded-lg border border-zrh-border p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <ZBadge tone={run.status === 'success' ? 'ok' : 'err'}>{run.status}</ZBadge>
                <span className="text-zrh-text-dim">#{run.id}</span>
                <span className="text-zrh-text-dim">{run.latencyMs} ms</span>
              </div>
              {run.error && <p className="mb-2 text-sm text-red-400">{run.error}</p>}
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs text-zrh-text">
                {JSON.stringify({ output: run.output, nodeRuns: run.nodeRuns }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'history',
      label: (
        <span className="flex items-center gap-1.5">
          <ScrollText className="h-4 w-4" /> {t('workflows.history')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-3">
          <ZButton size="sm" variant="secondary" onClick={() => void loadHistory()}>
            {t('workflows.refreshHistory')}
          </ZButton>
          {history.map((h) => (
            <div key={h.id} className="rounded-lg border border-zrh-border p-3 text-xs">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-medium text-zrh-text">{h.workflow?.name ?? h.workflowName}</span>
                <ZBadge tone={h.status === 'success' ? 'ok' : 'err'}>{h.status}</ZBadge>
                <span className="text-zrh-text-dim">{h.latencyMs} ms</span>
              </div>
              {h.error && <p className="text-red-400">{h.error}</p>}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'scheduler',
      label: (
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" /> {t('workflows.scheduler')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <ZButton size="sm" variant="secondary" onClick={() => void loadScheduler()}>
              {t('workflows.refreshScheduler')}
            </ZButton>
            <ZButton size="sm" disabled={!canAdmin} onClick={() => void createIntervalSchedule()}>
              {t('workflows.addSchedule')}
            </ZButton>
          </div>
          {schedules.map((s) => (
            <div key={s.id} className="rounded-lg border border-zrh-border p-3 text-xs">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-medium text-zrh-text">{s.name}</span>
                <ZBadge tone={s.enabled ? 'ok' : 'dim'}>{s.kind}</ZBadge>
              </div>
              <p className="text-zrh-text-dim">
                {s.workflow.name} · next: {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : '-'}
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
          <ScrollText className="h-4 w-4" /> {t('workflows.logs')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-3">
          {canAdmin ? (
            <ZButton size="sm" variant="secondary" onClick={() => void loadLogs()}>
              {t('workflows.refreshLogs')}
            </ZButton>
          ) : (
            <p className="text-sm text-zrh-text-dim">{t('workflows.logsAdminOnly')}</p>
          )}
          {logs.map((l) => (
            <div key={l.id} className="rounded-lg border border-zrh-border p-3 text-xs">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-medium text-zrh-text">{l.workflow.name}</span>
                <ZBadge tone="accent">{l.action}</ZBadge>
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
            <Workflow className="h-6 w-6 text-zrh-accent" />
            <h1 className="text-lg font-bold tracking-wider text-zrh-accent">{t('workflows.title')}</h1>
          </div>
          <p className="mt-1 text-xs text-zrh-text-dim sm:text-sm">{t('workflows.subtitle')}</p>
        </motion.div>

        {health && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-zrh-text-dim">
            <Activity className="h-3.5 w-3.5 text-zrh-accent" />
            <ZBadge tone={health.ok ? 'ok' : 'err'}>Health</ZBadge>
            <span>
              {t('workflows.templates')}: {health.workflows.templates}
            </span>
            <span>
              {t('workflows.enabled')}: {health.workflows.enabled}/{health.workflows.total}
            </span>
            <span>
              {t('workflows.errors24h')}: {health.runs.errors24h}
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
