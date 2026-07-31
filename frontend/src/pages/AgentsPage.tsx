import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Bot,
  BrainCircuit,
  ScrollText,
  Settings2,
  Sparkles,
  Activity,
  MemoryStick,
} from 'lucide-react';
import { ZButton, ZCard, ZInput, ZBadge, ZTabs } from '../components/ui';
import { TechBackground } from '../components/background/TechBackground';
import { fadeInUp, baseTransition } from '../design-system/animations';
import {
  agentsApi,
  AgentChatResult,
  AgentHealth,
  AgentMemoryItem,
  AgentProfile,
  AgentRunLog,
  AgentSkill,
} from '../api/agents';
import { useAuthStore } from '../store/authStore';

export function AgentsPage() {
  const { t } = useTranslation();
  const canWrite = useAuthStore((s) => s.hasPermission('api:agents:write'));
  const canChat = useAuthStore((s) => s.hasPermission('api:agents:chat'));
  const canAdmin = useAuthStore((s) => s.hasPermission('api:agents:admin'));

  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [selected, setSelected] = useState<string>('assistant');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<AgentChatResult | null>(null);
  const [memories, setMemories] = useState<AgentMemoryItem[]>([]);
  const [logs, setLogs] = useState<AgentRunLog[]>([]);
  const [routeHint, setRouteHint] = useState<string>('');

  const selectedAgent = useMemo(
    () => agents.find((a) => a.code === selected) ?? null,
    [agents, selected],
  );

  const load = async () => {
    setError(null);
    try {
      const [a, s, h] = await Promise.all([
        agentsApi.list(),
        agentsApi.skills(),
        agentsApi.health(),
      ]);
      setAgents(a);
      setSkills(s);
      setHealth(h);
      if (!a.find((x) => x.code === selected) && a[0]) setSelected(a[0].code);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selected) return;
    void agentsApi.memories(selected).then(setMemories).catch(() => setMemories([]));
  }, [selected]);

  const send = async () => {
    if (!message.trim() || !canChat) return;
    setLoading(true);
    setError(null);
    try {
      const routed = await agentsApi.route(message.trim());
      setRouteHint(`${routed.agentName} (${routed.reason})`);
      const result = await agentsApi.chat({
        message: message.trim(),
        agentCode: selected || routed.agentCode,
      });
      setChat(result);
      setMessage('');
      const mem = await agentsApi.memories(result.agentCode);
      setMemories(mem);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (agent: AgentProfile) => {
    if (!canWrite) return;
    try {
      if (agent.enabled) await agentsApi.disable(agent.code);
      else await agentsApi.enable(agent.code);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const loadLogs = async () => {
    if (!canAdmin) return;
    try {
      const data = await agentsApi.logs(1, 30);
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
          <Bot className="h-4 w-4" /> {t('agents.registry')}
        </span>
      ),
      content: (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <button
              key={a.code}
              type="button"
              onClick={() => setSelected(a.code)}
              className={`rounded-lg border p-3 text-left transition ${
                selected === a.code
                  ? 'border-zrh-accent bg-zrh-surface-raised'
                  : 'border-zrh-border bg-zrh-surface-raised/40 hover:border-zrh-accent/40'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-zrh-text">{a.name}</span>
                <ZBadge tone={a.enabled ? 'ok' : 'dim'}>{a.enabled ? t('agents.enabled') : t('agents.disabled')}</ZBadge>
              </div>
              <p className="mb-2 line-clamp-2 text-xs text-zrh-text-dim">{a.description}</p>
              <div className="flex flex-wrap gap-1">
                {a.skills.slice(0, 4).map((s) => (
                  <ZBadge key={s.code} tone="accent">{s.code}</ZBadge>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-zrh-text-dim">
                <span>v{a.version}</span>
                {canWrite && (
                  <ZButton
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggle(a);
                    }}
                  >
                    {a.enabled ? t('agents.disable') : t('agents.enable')}
                  </ZButton>
                )}
              </div>
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'chat',
      label: (
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4" /> {t('agents.chat')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-4">
          {selectedAgent && (
            <p className="text-xs text-zrh-text-dim">
              {t('agents.activeAgent')}: <span className="text-zrh-text">{selectedAgent.name}</span>
              {routeHint ? ` · ${t('agents.router')}: ${routeHint}` : ''}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <ZInput
              className="flex-1"
              placeholder={t('agents.chatPlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void send()}
            />
            <ZButton loading={loading} disabled={!canChat || !message.trim()} onClick={() => void send()}>
              <BrainCircuit className="h-4 w-4" />
              {t('agents.send')}
            </ZButton>
          </div>
          {chat && (
            <div className="rounded-lg border border-zrh-border bg-zrh-surface-raised/40 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zrh-text-dim">
                <ZBadge tone="accent">{chat.agentName}</ZBadge>
                <ZBadge tone="dim">{chat.skillUsed}</ZBadge>
                <span>{chat.latencyMs} ms</span>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-zrh-text">{chat.answer}</pre>
              {!!chat.citations?.length && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-zrh-accent">{t('agents.citations')}</p>
                  {chat.citations.map((c) => (
                    <p key={c.index} className="text-xs text-zrh-text-dim">
                      [#{c.index}] {c.title}: {c.snippet.slice(0, 120)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'memory',
      label: (
        <span className="flex items-center gap-1.5">
          <MemoryStick className="h-4 w-4" /> {t('agents.memory')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-2">
          {memories.length === 0 && <p className="text-sm text-zrh-text-dim">{t('agents.noMemory')}</p>}
          {memories.map((m) => (
            <div key={m.id} className="rounded-lg border border-zrh-border p-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-zrh-text-dim">
                <ZBadge tone="dim">{m.kind}</ZBadge>
                <span>{new Date(m.createdAt).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-zrh-text">{m.content}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'skills',
      label: (
        <span className="flex items-center gap-1.5">
          <Settings2 className="h-4 w-4" /> {t('agents.skills')}
        </span>
      ),
      content: (
        <div className="grid gap-2 sm:grid-cols-2">
          {skills.map((s) => (
            <div key={s.code} className="rounded-lg border border-zrh-border p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-zrh-text">{s.name}</span>
                <ZBadge tone={s.reserved ? 'warn' : s.enabled ? 'ok' : 'dim'}>
                  {s.reserved ? t('agents.reserved') : s.enabled ? t('agents.enabled') : t('agents.disabled')}
                </ZBadge>
              </div>
              <p className="text-xs text-zrh-text-dim">{s.description}</p>
              <p className="mt-1 text-[11px] text-zrh-text-dim">{s.code} · {s.category}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'logs',
      label: (
        <span className="flex items-center gap-1.5">
          <ScrollText className="h-4 w-4" /> {t('agents.logs')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-3">
          {canAdmin ? (
            <ZButton size="sm" variant="secondary" onClick={() => void loadLogs()}>
              {t('agents.refreshLogs')}
            </ZButton>
          ) : (
            <p className="text-sm text-zrh-text-dim">{t('agents.logsAdminOnly')}</p>
          )}
          {logs.map((l) => (
            <div key={l.id} className="rounded-lg border border-zrh-border p-3 text-xs">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-medium text-zrh-text">{l.agent.name}</span>
                <ZBadge tone={l.status === 'success' ? 'ok' : 'err'}>{l.status}</ZBadge>
                <span className="text-zrh-text-dim">{l.latencyMs} ms</span>
              </div>
              <p className="text-zrh-text-dim">{l.inputSummary}</p>
              {l.error && <p className="mt-1 text-red-400">{l.error}</p>}
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
            <Bot className="h-6 w-6 text-zrh-accent" />
            <h1 className="text-lg font-bold tracking-wider text-zrh-accent">{t('agents.title')}</h1>
          </div>
          <p className="mt-1 text-xs text-zrh-text-dim sm:text-sm">{t('agents.subtitle')}</p>
        </motion.div>

        {health && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-zrh-text-dim">
            <Activity className="h-3.5 w-3.5 text-zrh-accent" />
            <ZBadge tone={health.ok ? 'ok' : 'err'}>Health</ZBadge>
            <span>
              {t('agents.active')}: {health.agents.active}/{health.agents.total}
            </span>
            <span>
              {t('agents.skills')}: {health.skills.enabled}/{health.skills.total}
            </span>
            <span>
              {t('agents.errors24h')}: {health.logs.errors24h}
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
