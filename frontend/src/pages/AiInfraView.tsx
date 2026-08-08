import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v12Api } from '../api/v12';
import { ZButton, ZCard } from '../components/ui';

type NodeRuntime = {
  id: string;
  label: string;
  providerCode: string;
  connection: string;
  enabled: boolean;
  health: string;
  circuit: string;
  lastLatencyMs: number | null;
  lastSeenAt: string | null;
  lastTtftMs: number | null;
  lastTokensPerSec: number | null;
  lastError: string | null;
};

type Snapshot = {
  enabled: boolean;
  routingMode: 'AUTO' | 'GPU_ONLY' | 'CPU_ONLY';
  strategy: string;
  currentPreferred: string | null;
  nodes: NodeRuntime[];
  internal?: {
    laptopOllamaBaseUrl: string;
    serverOllamaBaseUrl: string;
  };
};

function healthTone(health: string): string {
  if (health === 'HEALTHY') return 'text-emerald-400';
  if (health === 'DEGRADED' || health === 'RECOVERING') return 'text-amber-400';
  if (health === 'DISABLED') return 'text-zrh-text-dim';
  return 'text-rose-400';
}

/** SUPER_ADMIN — AI Infrastructure / Inference Nodes */
export function AiInfraView() {
  const { t } = useTranslation();
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const snap = await v12Api.superAiInference();
      setData(snap as Snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(id);
  }, [load]);

  const setMode = async (mode: Snapshot['routingMode']) => {
    setBusy(true);
    try {
      const snap = await v12Api.superAiInferenceMode(mode);
      setData(snap as Snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const setNode = async (nodeId: string, enabled: boolean) => {
    setBusy(true);
    try {
      const snap = await v12Api.superAiInferenceNode(nodeId, enabled);
      setData(snap as Snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-zrh-accent">{t('superadmin.aiInfra')}</h1>
          <p className="mt-1 text-xs text-zrh-text-dim">{t('superadmin.aiInfraHint')}</p>
        </div>
        <ZButton type="button" disabled={busy} onClick={() => void load()}>
          {t('common.retry')}
        </ZButton>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      {data ? (
        <>
          <ZCard title={t('superadmin.aiRouting')} glow>
            <div className="space-y-2 text-sm">
              <p>
                {t('superadmin.aiHybridFlag')}:{' '}
                <span className={data.enabled ? 'text-emerald-400' : 'text-amber-400'}>
                  {data.enabled ? 'ON' : 'OFF'}
                </span>
              </p>
              <p>
                {t('superadmin.aiStrategy')}: {data.strategy}
              </p>
              <p>
                {t('superadmin.aiPreferred')}: {data.currentPreferred ?? '—'}
              </p>
              <p>
                {t('superadmin.aiMode')}: <strong>{data.routingMode}</strong>
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {(['AUTO', 'GPU_ONLY', 'CPU_ONLY'] as const).map((mode) => (
                  <ZButton
                    key={mode}
                    type="button"
                    disabled={busy || data.routingMode === mode}
                    onClick={() => void setMode(mode)}
                  >
                    {mode}
                  </ZButton>
                ))}
              </div>
            </div>
          </ZCard>

          <div className="grid gap-4 lg:grid-cols-2">
            {data.nodes.map((node) => (
              <ZCard key={node.id} title={node.label} glow hud>
                <div className="space-y-1 text-xs text-zrh-text-dim">
                  <p>
                    {t('superadmin.aiStatus')}:{' '}
                    <span className={healthTone(node.health)}>{node.health}</span>
                  </p>
                  <p>
                    Provider: {node.providerCode} · {node.connection}
                  </p>
                  <p>Circuit: {node.circuit}</p>
                  <p>
                    Latency: {node.lastLatencyMs ?? '—'} ms · TTFT: {node.lastTtftMs ?? '—'} ms
                  </p>
                  <p>Tokens/s: {node.lastTokensPerSec ?? '—'}</p>
                  <p>Last seen: {node.lastSeenAt ?? '—'}</p>
                  {node.lastError ? <p className="text-rose-400">Error: {node.lastError}</p> : null}
                  <div className="flex gap-2 pt-2">
                    <ZButton
                      type="button"
                      disabled={busy || node.enabled}
                      onClick={() => void setNode(node.id, true)}
                    >
                      {t('common.on')}
                    </ZButton>
                    <ZButton
                      type="button"
                      disabled={busy || !node.enabled}
                      onClick={() => void setNode(node.id, false)}
                    >
                      {t('common.off')}
                    </ZButton>
                  </div>
                </div>
              </ZCard>
            ))}
          </div>

          {data.internal ? (
            <ZCard title={t('superadmin.aiInternal')} glow>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-zrh-text-dim">
                {JSON.stringify(data.internal, null, 2)}
              </pre>
            </ZCard>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-zrh-text-dim">{t('common.loading')}</p>
      )}
    </div>
  );
}
