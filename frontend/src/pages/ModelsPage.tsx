import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { RefreshCw, Plus, Trash2, Activity, Cpu, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { ZButton, ZCard, ZBadge } from '../components/ui';
import { TechBackground } from '../components/background/TechBackground';
import { fadeInUp, baseTransition } from '../design-system/animations';
import { aiApi, AIProviderInfo, AIModelInfo, AIPullProgress, pullModelStream } from '../api/ai';
import { useAuthStore } from '../store/authStore';

function formatBytes(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v <= 0) return '—';
  return `${(v / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function statusTone(status: string): 'ok' | 'warn' | 'err' | 'dim' {
  if (status === 'online' || status === 'running') return 'ok';
  if (status === 'loading') return 'warn';
  if (status === 'error') return 'err';
  return 'dim';
}

export function ModelsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuthStore();
  const canAdmin = hasPermission('api:ai:admin');

  const [providers, setProviders] = useState<AIProviderInfo[]>([]);
  const [models, setModels] = useState<AIModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState<Record<string, AIPullProgress | null>>({});
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, m] = await Promise.all([aiApi.providers(), aiApi.models()]);
      setProviders(p.providers);
      setModels(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const modelsByProvider = useMemo(() => {
    const map = new Map<string, AIModelInfo[]>();
    for (const m of models) {
      const list = map.get(m.providerCode) ?? [];
      list.push(m);
      map.set(m.providerCode, list);
    }
    return map;
  }, [models]);

  const handleSetDefault = async (providerCode: string, name: string) => {
    try {
      await aiApi.setDefaultModel(providerCode, name);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleToggleEnabled = async (m: AIModelInfo) => {
    try {
      await aiApi.setModelEnabled(m.providerCode, m.name, !m.enabled);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async (m: AIModelInfo) => {
    if (!window.confirm(t('models.deleteConfirm', { name: m.displayName || m.name }))) return;
    try {
      await aiApi.deleteModel(m.providerCode, m.name);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handlePull = async (m: AIModelInfo) => {
    const key = `${m.providerCode}:${m.name}`;
    setPulling((prev) => ({ ...prev, [key]: { status: 'pulling' } }));
    try {
      await pullModelStream(m.providerCode, m.name, (progress) => {
        setPulling((prev) => ({ ...prev, [key]: progress }));
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPulling((prev) => ({ ...prev, [key]: { status: 'error', error: String(e) } }));
    }
  };

  return (
    <TechBackground>
      <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 px-3 py-5 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold tracking-wider text-zrh-accent">{t('models.title')}</h1>
          <ZButton variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </ZButton>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Providers */}
          <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={baseTransition}>
            <ZCard title={t('models.providers')} hud glow className="h-full">
              <div className="flex flex-col gap-3">
                {providers.map((p) => (
                  <div
                    key={p.code}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zrh-border/50 bg-zrh-surface-raised/40 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-zrh-accent" />
                      <span className="text-sm font-medium text-zrh-text">{p.code.toUpperCase()}</span>
                    </div>
                    <ZBadge tone={p.enabled ? 'ok' : 'dim'}>{p.enabled ? t('models.enabled') : t('models.disabled')}</ZBadge>
                  </div>
                ))}
                {providers.length === 0 && !loading && (
                  <p className="text-sm text-zrh-text-dim">{t('models.noProviders')}</p>
                )}
              </div>
            </ZCard>
          </motion.div>

          {/* Models */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ ...baseTransition, delay: 0.1 }}
            className="lg:col-span-2"
          >
            <ZCard title={t('models.registry')} hud glow padded={false} className="h-full">
              <div className="flex flex-col">
                {Array.from(modelsByProvider.entries()).map(([providerCode, list]) => (
                  <div key={providerCode} className="border-b border-zrh-border/40 last:border-0">
                    <div className="flex items-center gap-2 bg-zrh-surface-raised/30 px-4 py-2">
                      <Activity className="h-3.5 w-3.5 text-zrh-accent" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-zrh-text-dim">
                        {providerCode}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 p-2">
                      {list.map((m) => {
                        const key = `${m.providerCode}:${m.name}`;
                        const progress = pulling[key];
                        return (
                          <div
                            key={key}
                            className="flex flex-col gap-2 rounded-lg border border-zrh-border/40 p-3 hover:border-zrh-accent/30"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-sm font-medium text-zrh-text">
                                    {m.displayName || m.name}
                                  </span>
                                  {m.isDefault && (
                                    <ZBadge tone="ok" className="text-[10px]">
                                      {t('models.default')}
                                    </ZBadge>
                                  )}
                                </div>
                                <p className="truncate text-[11px] text-zrh-text-dim">{m.name}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-zrh-text-dim">
                                  <span>{formatBytes(m.sizeBytes)}</span>
                                  <span>·</span>
                                  <span>{m.contextLength.toLocaleString()} ctx</span>
                                  {m.capabilities.length > 0 && (
                                    <>
                                      <span>·</span>
                                      <span>{m.capabilities.join(', ')}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <ZBadge tone={statusTone(m.status)} className="shrink-0 text-[10px]">
                                {t(`chat.modelStatus.${m.status as 'online' | 'loading' | 'running' | 'stopped' | 'error'}`)}
                              </ZBadge>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {!m.isDefault && m.enabled && (
                                <ZButton variant="ghost" size="sm" onClick={() => void handleSetDefault(m.providerCode, m.name)}>
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  {t('models.setDefault')}
                                </ZButton>
                              )}
                              {canAdmin && (
                                <>
                                  <ZButton variant="ghost" size="sm" onClick={() => void handleToggleEnabled(m)}>
                                    {m.enabled ? (
                                      <>
                                        <XCircle className="h-3.5 w-3.5" /> {t('models.disable')}
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="h-3.5 w-3.5" /> {t('models.enable')}
                                      </>
                                    )}
                                  </ZButton>
                                  {m.status === 'online' ? (
                                    <ZButton variant="ghost" size="sm" onClick={() => void handleDelete(m)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                      {t('models.delete')}
                                    </ZButton>
                                  ) : (
                                    <ZButton
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => void handlePull(m)}
                                      disabled={!!progress && progress.status === 'pulling'}
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      {t('models.install')}
                                    </ZButton>
                                  )}
                                </>
                              )}
                            </div>

                            {progress && progress.status === 'pulling' && progress.total && (
                              <div className="mt-1">
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zrh-border">
                                  <div
                                    className="h-full bg-zrh-accent transition-all"
                                    style={{ width: `${Math.min(100, (progress.completed ?? 0) / progress.total * 100)}%` }}
                                  />
                                </div>
                                <p className="mt-1 text-[10px] text-zrh-text-dim">
                                  {((progress.completed ?? 0) / 1024 / 1024).toFixed(1)} MB /{' '}
                                  {((progress.total ?? 0) / 1024 / 1024).toFixed(1)} MB
                                </p>
                              </div>
                            )}
                            {progress?.status === 'error' && (
                              <p className="flex items-center gap-1 text-[11px] text-red-400">
                                <AlertCircle className="h-3 w-3" /> {progress.error}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {models.length === 0 && !loading && (
                  <p className="p-4 text-sm text-zrh-text-dim">{t('models.noModels')}</p>
                )}
              </div>
            </ZCard>
          </motion.div>
        </div>
      </div>
    </TechBackground>
  );
}
