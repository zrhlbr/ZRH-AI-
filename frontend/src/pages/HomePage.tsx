import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TechBackground } from '../components/background/TechBackground';
import { DigitalGlobe } from '../components/background/DigitalGlobe';
import { ZBadge, ZCard } from '../components/ui';
import { zrhIcons } from '../design-system/icons';
import { brand } from '../design-system/theme';
import { fadeInUp, baseTransition } from '../design-system/animations';
import { api, HealthReport, OllamaModel, OllamaStatus, SystemMetric } from '../api/client';
import { chatApi, ChatStats } from '../api/chat';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';

type PanelState = 'loading' | 'online' | 'offline' | 'nodata';

interface Panels {
  cpu: SystemMetric | null;
  gpu: SystemMetric | null;
  memory: SystemMetric | null;
  docker: SystemMetric | null;
  health: HealthReport | null;
  ollama: OllamaStatus | null;
  models: OllamaModel[] | null;
}

const initialPanels: Panels = {
  cpu: null,
  gpu: null,
  memory: null,
  docker: null,
  health: null,
  ollama: null,
  models: null,
};

function stateBadge(state: PanelState, t: (k: string) => string) {
  if (state === 'loading') return <ZBadge tone="dim">{t('status.loading')}</ZBadge>;
  if (state === 'online') return <ZBadge tone="ok" dot>{t('status.online')}</ZBadge>;
  return <ZBadge tone="err" dot>{t('status.offline')}</ZBadge>;
}

function metricState(m: SystemMetric | null): PanelState {
  if (!m) return 'loading';
  return m.available ? 'online' : 'offline';
}

function bytes(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `${(v / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/**
 * 首页科技大屏（阶段 2 基础版）
 * 中央 AI 输入区 + 右侧实时状态（CPU/GPU/Memory/Docker/Redis/PostgreSQL/Ollama/Models）。
 */
export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const setPendingHomeMessage = useChatStore((s) => s.setPendingHomeMessage);
  const [panels, setPanels] = useState<Panels>(initialPanels);
  const [chatStats, setChatStats] = useState<ChatStats | null>(null);
  const [input, setInput] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const safe = <T,>(p: Promise<T>) => p.catch(() => null);
      const [cpu, gpu, memory, docker, health, ollama, models, stats] = await Promise.all([
        hasPermission('api:system:cpu') ? safe(api.systemCpu()) : null,
        hasPermission('api:system:gpu') ? safe(api.systemGpu()) : null,
        hasPermission('api:system:memory') ? safe(api.systemMemory()) : null,
        hasPermission('api:system:docker') ? safe(api.systemDocker()) : null,
        safe(api.health()),
        hasPermission('api:ollama:read') ? safe(api.ollamaHealth()) : null,
        hasPermission('api:ollama:read') ? safe(api.ollamaModels()) : null,
        hasPermission('api:chat:read') ? safe(chatApi.stats()) : null,
      ]);
      if (!alive) return;
      setPanels({
        cpu,
        gpu,
        memory,
        docker,
        health,
        ollama,
        models: models?.models ?? null,
      });
      setChatStats(stats ?? null);
    };
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [hasPermission]);

  // 首页输入 → 携带首条消息进入 AI 对话
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    setPendingHomeMessage(value);
    navigate('/chat');
  };

  const SendIcon = zrhIcons.send;

  const statusItems: Array<{ label: string; icon: typeof zrhIcons.cpu; state: PanelState; detail?: string }> = [
    {
      label: 'CPU',
      icon: zrhIcons.cpu,
      state: metricState(panels.cpu),
      detail: panels.cpu?.available
        ? `${panels.cpu.cores} ${t('status.cores')} · ${t('status.load')} ${Number((panels.cpu.loadAvg as Record<string, number>)?.['1m'] ?? 0).toFixed(2)}`
        : undefined,
    },
    {
      label: 'GPU',
      icon: zrhIcons.gpu,
      state: metricState(panels.gpu),
      detail: panels.gpu?.available
        ? `${panels.gpu.name} · ${panels.gpu.utilizationPercent}%`
        : panels.gpu
          ? t('status.unavailable')
          : undefined,
    },
    {
      label: t('status.memory'),
      icon: zrhIcons.memory,
      state: metricState(panels.memory),
      detail: panels.memory?.available
        ? `${bytes(panels.memory.usedBytes)} / ${bytes(panels.memory.totalBytes)}`
        : undefined,
    },
    {
      label: 'Docker',
      icon: zrhIcons.docker,
      state: metricState(panels.docker),
      detail: panels.docker?.available ? `Engine ${panels.docker.engineVersion ?? ''}` : undefined,
    },
    {
      label: 'Redis',
      icon: zrhIcons.redis,
      state: panels.health ? (panels.health.redis === 'online' ? 'online' : 'offline') : 'loading',
    },
    {
      label: 'PostgreSQL',
      icon: zrhIcons.database,
      state: panels.health ? (panels.health.database === 'online' ? 'online' : 'offline') : 'loading',
    },
    {
      label: 'Ollama',
      icon: zrhIcons.ai,
      state: panels.ollama ? (panels.ollama.status === 'online' ? 'online' : 'offline') : 'loading',
      detail:
        panels.ollama?.status === 'online' && panels.ollama.latencyMs !== undefined
          ? `${panels.ollama.latencyMs} ms`
          : undefined,
    },
  ];

  return (
    <TechBackground>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-6 sm:px-5 xl:flex-row">
        {/* 中央：AI 输入区 */}
        <motion.section
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={baseTransition}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-8 py-8 sm:py-14"
        >
          <div className="relative flex w-full max-w-xl flex-col items-center">
            {/* AI 光环：数字地球外围双环脉动 */}
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2">
              <div className="zrh-ai-halo" aria-hidden />
              <div className="zrh-ai-halo zrh-ai-halo--slow" aria-hidden />
            </div>
            <DigitalGlobe className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 opacity-60" />
            <div className="relative z-10 mt-28 text-center">
              <h1 className="text-3xl font-bold tracking-[0.2em] text-zrh-accent sm:text-4xl">
                {brand.name}
              </h1>
              <p className="mt-2 text-xs tracking-widest text-zrh-text-dim sm:text-sm">
                {brand.subtitle}
              </p>
              {/* 实时统计：模型数量 / 聊天数量 */}
              {chatStats && (
                <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-zrh-text-dim">
                  <span>
                    {t('chat.modelCount')} <span className="font-mono text-zrh-accent">{chatStats.models}</span>
                  </span>
                  <span className="h-3 w-px bg-zrh-border" aria-hidden />
                  <span>
                    {t('chat.chatCount')} <span className="font-mono text-zrh-accent">{chatStats.conversations}</span>
                  </span>
                  <span className="h-3 w-px bg-zrh-border" aria-hidden />
                  <span>
                    {t('chat.messageCount')} <span className="font-mono text-zrh-accent">{chatStats.messages}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={submit}
            className="zrh-glass zrh-glow-border zrh-hud flex w-full max-w-xl items-center gap-2 rounded-2xl p-2.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('home.aiInputPlaceholder')}
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-zrh-text outline-none placeholder:text-zrh-text-dim/60"
            />
            <button
              type="submit"
              aria-label={t('home.send')}
              className="rounded-xl bg-zrh-accent p-2.5 text-zrh-bg transition-colors hover:bg-zrh-accent-soft"
            >
              <SendIcon className="h-4 w-4" aria-hidden />
            </button>
          </form>
          <p className="max-w-xl text-center text-[10px] text-zrh-text-dim/60">
            {t('home.aiInputStageHint')}
          </p>
        </motion.section>

        {/* 右侧：实时状态面板 */}
        <motion.aside
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ ...baseTransition, delay: 0.1 }}
          className="w-full shrink-0 xl:w-80"
        >
          <ZCard title={t('status.realtime')} hud glow padded={false} className="zrh-glass">
            <div className="flex flex-col p-3">
              {statusItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-2 border-b border-zrh-border/40 px-2 py-2.5 last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <item.icon className="h-4 w-4 shrink-0 text-zrh-accent/80" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-xs text-zrh-text sm:text-sm">{item.label}</p>
                      {item.detail && (
                        <p className="truncate text-[10px] text-zrh-text-dim">{item.detail}</p>
                      )}
                    </div>
                  </div>
                  {stateBadge(item.state, t)}
                </div>
              ))}

              {/* Models */}
              <div className="px-2 py-2.5">
                <div className="mb-2 flex items-center gap-2.5">
                  <zrhIcons.ai className="h-4 w-4 text-zrh-accent/80" aria-hidden />
                  <p className="text-xs text-zrh-text sm:text-sm">{t('status.models')}</p>
                </div>
                {!panels.models && (
                  <p className="pl-6 text-[10px] text-zrh-text-dim">{t('status.loading')}</p>
                )}
                {panels.models && (
                  <ul className="flex flex-col gap-1 pl-6">
                    {panels.models.map((m) => (
                      <li key={m.digest || m.name} className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] text-zrh-text">{m.name}</span>
                        <span className="shrink-0 text-[10px] text-zrh-text-dim">
                          {(m.size / 1024 / 1024 / 1024).toFixed(1)} GB
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </ZCard>
        </motion.aside>
      </div>
    </TechBackground>
  );
}
