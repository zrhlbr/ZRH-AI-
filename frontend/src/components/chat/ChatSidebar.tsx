import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store/chatStore';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { api, SystemMetric } from '../../api/client';
import type { ChatParams, ModelRuntimeStatus } from '../../api/chat';

/** 模型实时状态徽标 */
function ModelStatusBadge({ status }: { status: ModelRuntimeStatus }) {
  const { t } = useTranslation();
  const cls =
    status === 'running'
      ? 'border-emerald-500/40 text-emerald-400'
      : status === 'online'
        ? 'border-sky-500/40 text-sky-400'
        : status === 'loading'
          ? 'border-amber-500/40 text-amber-400'
          : status === 'error'
            ? 'border-red-500/40 text-red-400'
            : 'border-zrh-border text-zrh-text-dim';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[9px] ${cls}`}>
      {t(`chat.modelStatus.${status}`)}
    </span>
  );
}

/** 参数滑杆行 */
function ParamSlider({
  label,
  name,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-zrh-text-dim">{label}</span>
        <span className="rounded bg-zrh-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-zrh-accent">{value}</span>
      </div>
      <input
        type="range"
        name={name}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="zrh-slider w-full"
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-zrh-border/40 p-3 last:border-0">
      <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-zrh-text-dim/80">{title}</h3>
      {children}
    </section>
  );
}

/**
 * 右侧栏：模型实时状态 / 生成参数（保存数据库）/ 系统状态 / 动画开关。
 */
export function ChatSidebar() {
  const { t } = useTranslation();
  const { modelsStatus, loadModels, params, loadParams, saveParams, stats } = useChatStore();
  const { animationsEnabled, setAnimationsEnabled } = useThemeStore();
  const { hasPermission } = useAuthStore();
  const [draft, setDraft] = useState<ChatParams | null>(null);
  const [sys, setSys] = useState<{ cpu: SystemMetric | null; gpu: SystemMetric | null; docker: SystemMetric | null; ollama: string }>({
    cpu: null,
    gpu: null,
    docker: null,
    ollama: 'offline',
  });

  useEffect(() => {
    void loadParams();
  }, [loadParams]);

  useEffect(() => {
    if (params && !draft) setDraft(params);
  }, [params, draft]);

  // 模型状态 + 系统状态实时刷新
  useEffect(() => {
    let alive = true;
    const load = async () => {
      await loadModels();
      const safe = <T,>(p: Promise<T>) => p.catch(() => null);
      const [cpu, gpu, docker, ollama] = await Promise.all([
        hasPermission('api:system:cpu') ? safe(api.systemCpu()) : null,
        hasPermission('api:system:gpu') ? safe(api.systemGpu()) : null,
        hasPermission('api:system:docker') ? safe(api.systemDocker()) : null,
        safe(api.ollamaHealth()),
      ]);
      if (!alive) return;
      setSys({ cpu, gpu, docker, ollama: ollama?.status ?? 'offline' });
    };
    void load();
    const timer = setInterval(() => void load(), 8000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [loadModels, hasPermission]);

  const updateDraft = (patch: Partial<ChatParams>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  const persist = (patch: Partial<ChatParams>) => {
    void saveParams(patch);
  };

  const sysRow = (label: string, online: boolean | null, detail?: string) => (
    <div className="flex items-center justify-between py-1 text-[11px]">
      <span className="text-zrh-text-dim">{label}</span>
      <span className="flex items-center gap-1.5">
        {detail && <span className="max-w-24 truncate text-[10px] text-zrh-text-dim/70">{detail}</span>}
        <span className={`h-1.5 w-1.5 rounded-full ${online === null ? 'bg-zrh-text-dim/40' : online ? 'bg-emerald-400' : 'bg-red-400'}`} aria-hidden />
      </span>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      {/* 模型状态 */}
      <Section title={t('chat.modelsStatus')}>
        <ul className="flex flex-col gap-1.5">
          {modelsStatus.map((m) => (
            <li key={m.name} className="flex items-center justify-between gap-2 rounded-lg border border-zrh-border/40 bg-black/20 px-2.5 py-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] text-zrh-text">{m.displayName}</p>
                <p className="truncate text-[9px] text-zrh-text-dim/70">
                  {m.name}
                  {m.vramBytes ? ` · VRAM ${(m.vramBytes / 1024 / 1024 / 1024).toFixed(1)}GB` : ''}
                </p>
              </div>
              <ModelStatusBadge status={m.status} />
            </li>
          ))}
        </ul>
        {stats && (
          <p className="mt-2 text-[10px] text-zrh-text-dim">
            {t('chat.modelCount')}: {stats.models} · {t('chat.chatCount')}: {stats.conversations}
          </p>
        )}
      </Section>

      {/* 参数设置 */}
      <Section title={t('chat.params')}>
        {draft ? (
          <div className="flex flex-col gap-3">
            <ParamSlider label={t('chat.temperature')} name="temperature" value={draft.temperature} min={0} max={2} step={0.1}
              onChange={(v) => updateDraft({ temperature: v })} />
            <ParamSlider label={t('chat.topP')} name="topP" value={draft.topP} min={0} max={1} step={0.05}
              onChange={(v) => updateDraft({ topP: v })} />
            <ParamSlider label={t('chat.topK')} name="topK" value={draft.topK} min={0} max={100} step={1}
              onChange={(v) => updateDraft({ topK: v })} />
            <ParamSlider label={t('chat.repeatPenalty')} name="repeatPenalty" value={draft.repeatPenalty} min={0} max={2} step={0.05}
              onChange={(v) => updateDraft({ repeatPenalty: v })} />
            <ParamSlider label={t('chat.contextLength')} name="contextLength" value={draft.contextLength} min={512} max={32768} step={512}
              onChange={(v) => updateDraft({ contextLength: v })} />
            <ParamSlider label={t('chat.maxTokens')} name="maxTokens" value={draft.maxTokens} min={16} max={8192} step={16}
              onChange={(v) => updateDraft({ maxTokens: v })} />
            <button
              type="button"
              data-testid="save-params"
              onClick={() =>
                persist({
                  temperature: draft.temperature,
                  topP: draft.topP,
                  topK: draft.topK,
                  repeatPenalty: draft.repeatPenalty,
                  contextLength: draft.contextLength,
                  maxTokens: draft.maxTokens,
                })
              }
              className="mt-1 rounded-lg border border-zrh-accent/40 bg-zrh-accent/10 py-1.5 text-[11px] font-semibold text-zrh-accent transition-colors hover:bg-zrh-accent/20"
            >
              {t('chat.saveParams')}
            </button>
            <p className="text-[9px] text-zrh-text-dim/60">{t('chat.paramsHint')}</p>
          </div>
        ) : (
          <p className="text-[11px] text-zrh-text-dim">{t('status.loading')}</p>
        )}
      </Section>

      {/* 系统状态 */}
      <Section title={t('chat.systemStatus')}>
        {sysRow('CPU', sys.cpu ? Boolean(sys.cpu.available) : null,
          sys.cpu?.available ? `${Number((sys.cpu.loadAvg as Record<string, number>)?.['1m'] ?? 0).toFixed(2)}` : undefined)}
        {sysRow('GPU', sys.gpu ? Boolean(sys.gpu.available) : null,
          sys.gpu?.available ? `${sys.gpu.utilizationPercent}%` : undefined)}
        {sysRow('Docker', sys.docker ? Boolean(sys.docker.available) : null,
          sys.docker?.available ? `Engine ${sys.docker.engineVersion ?? ''}` : undefined)}
        {sysRow('Ollama', sys.ollama === 'online')}
      </Section>

      {/* 动画开关 */}
      <Section title={t('chat.animations')}>
        <button
          type="button"
          role="switch"
          aria-checked={animationsEnabled}
          onClick={() => setAnimationsEnabled(!animationsEnabled)}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-[11px] transition-colors ${
            animationsEnabled
              ? 'border-zrh-accent/40 bg-zrh-accent/10 text-zrh-accent'
              : 'border-zrh-border/60 text-zrh-text-dim'
          }`}
        >
          <span>{animationsEnabled ? t('chat.animationsOn') : t('chat.animationsOff')}</span>
          <span className={`relative h-4 w-8 rounded-full transition-colors ${animationsEnabled ? 'bg-zrh-accent/60' : 'bg-zrh-border'}`}>
            <span
              className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                animationsEnabled ? 'translate-x-4' : ''
              }`}
            />
          </span>
        </button>
      </Section>
    </div>
  );
}
