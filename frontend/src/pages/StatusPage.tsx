import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { ZBadge, ZButton, ZCard, ZTable } from '../components/ui';
import {
  api,
  HealthReport,
  OllamaModel,
  OllamaStatus,
  SystemMetric,
} from '../api/client';
import { useAuthStore } from '../store/authStore';

interface StatusData {
  health: HealthReport | null;
  ollama: OllamaStatus | null;
  models: OllamaModel[] | null;
  cpu: SystemMetric | null;
  memory: SystemMetric | null;
  storage: SystemMetric | null;
  network: SystemMetric | null;
  docker: SystemMetric | null;
  gpu: SystemMetric | null;
}

const initial: StatusData = {
  health: null,
  ollama: null,
  models: null,
  cpu: null,
  memory: null,
  storage: null,
  network: null,
  docker: null,
  gpu: null,
};

/**
 * 系统状态页 — 通过 /api/v1 真实接口展示后端与各子系统状态。
 */
export function StatusPage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuthStore();
  const [data, setData] = useState<StatusData>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const safe = <T,>(p: Promise<T>) => p.catch(() => null);
    try {
      const [health, ollama, models, cpu, memory, storage, network, docker, gpu] =
        await Promise.all([
          safe(api.health()),
          hasPermission('api:ollama:read') ? safe(api.ollamaHealth()) : null,
          hasPermission('api:ollama:read') ? safe(api.ollamaModels()) : null,
          hasPermission('api:system:cpu') ? safe(api.systemCpu()) : null,
          hasPermission('api:system:memory') ? safe(api.systemMemory()) : null,
          hasPermission('api:system:storage') ? safe(api.systemStorage()) : null,
          hasPermission('api:system:network') ? safe(api.systemNetwork()) : null,
          hasPermission('api:system:docker') ? safe(api.systemDocker()) : null,
          hasPermission('api:system:gpu') ? safe(api.systemGpu()) : null,
        ]);
      setData({
        health,
        ollama,
        models: models?.models ?? null,
        cpu,
        memory,
        storage,
        network,
        docker,
        gpu,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const badge = (online: boolean | null) =>
    online === null ? (
      <ZBadge tone="dim">{t('status.loading')}</ZBadge>
    ) : (
      <ZBadge tone={online ? 'ok' : 'err'} dot>
        {online ? t('status.online') : t('status.offline')}
      </ZBadge>
    );

  const gb = (n: unknown) => (Number.isFinite(Number(n)) ? `${(Number(n) / 1073741824).toFixed(1)} GB` : '—');

  const cards: Array<{ label: string; badgeNode: React.ReactNode; detail?: string }> = [
    {
      label: t('status.backend'),
      badgeNode: badge(data.health ? data.health.status === 'ok' || data.health.status === 'degraded' : null),
      detail: data.health ? `${data.health.service} · v${data.health.version}` : undefined,
    },
    { label: t('status.database'), badgeNode: badge(data.health ? data.health.database === 'online' : null) },
    { label: t('status.redis'), badgeNode: badge(data.health ? data.health.redis === 'online' : null) },
    {
      label: t('status.ollama'),
      badgeNode: badge(data.ollama ? data.ollama.status === 'online' : null),
      detail: data.ollama?.latencyMs !== undefined ? `${t('status.latency')}: ${data.ollama.latencyMs} ms` : data.ollama?.error,
    },
    {
      label: 'CPU',
      badgeNode: badge(data.cpu ? Boolean(data.cpu.available) : null),
      detail: data.cpu?.available ? `${data.cpu.cores} ${t('status.cores')}` : undefined,
    },
    {
      label: t('status.memory'),
      badgeNode: badge(data.memory ? Boolean(data.memory.available) : null),
      detail: data.memory?.available ? `${gb(data.memory.usedBytes)} / ${gb(data.memory.totalBytes)}` : undefined,
    },
    {
      label: 'GPU',
      badgeNode: badge(data.gpu ? Boolean(data.gpu.available) : null),
      detail: data.gpu?.available ? String(data.gpu.name) : data.gpu ? t('status.unavailable') : undefined,
    },
    {
      label: 'Docker',
      badgeNode: badge(data.docker ? Boolean(data.docker.available) : null),
      detail: data.docker?.available ? `Engine ${String(data.docker.engineVersion ?? '')}` : undefined,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3 py-6 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-zrh-accent sm:text-2xl">{t('status.system')}</h1>
        {hasPermission('button:status:refresh') && (
          <ZButton variant="secondary" size="sm" onClick={() => void refresh()} loading={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            {t('status.refresh')}
          </ZButton>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-zrh-err/40 bg-zrh-err/10 px-4 py-3 text-sm text-zrh-err">
          {t('status.error')}: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <ZCard key={card.label}>
            <p className="text-xs text-zrh-text-dim sm:text-sm">{card.label}</p>
            <p className="mt-2">{card.badgeNode}</p>
            {card.detail && <p className="mt-1.5 break-all text-xs text-zrh-text-dim">{card.detail}</p>}
          </ZCard>
        ))}
      </div>

      {data.health && (
        <p className="text-xs text-zrh-text-dim">
          {t('status.timestamp')}: {data.health.timestamp}
        </p>
      )}

      <ZCard title={t('status.models')}>
        {!data.models && <p className="text-sm text-zrh-text-dim">{t('status.loading')}</p>}
        {data.models && (
          <ZTable
            columns={[
              { key: 'name', header: t('status.modelName'), render: (m: OllamaModel) => m.name },
              {
                key: 'size',
                header: t('status.modelSize'),
                render: (m) => `${(m.size / 1073741824).toFixed(1)} GB`,
              },
              {
                key: 'modified',
                header: t('status.modelModified'),
                render: (m) => new Date(m.modified_at).toLocaleString(),
              },
            ]}
            data={data.models}
            rowKey={(m) => m.digest || m.name}
            emptyText={t('status.noData')}
          />
        )}
      </ZCard>
    </div>
  );
}
