import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { useStatusStore } from '../store/statusStore';

function StatusBadge({ online }: { online: boolean | null }) {
  const { t } = useTranslation();
  if (online === null) {
    return <span className="text-zrh-text-dim">{t('status.loading')}</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold ${online ? 'text-zrh-ok' : 'text-zrh-err'}`}>
      <span className={`h-2 w-2 rounded-full ${online ? 'bg-zrh-ok' : 'bg-zrh-err'}`} />
      {online ? t('status.online') : t('status.offline')}
    </span>
  );
}

export function StatusPage() {
  const { t } = useTranslation();
  const { loading, error, health, ollama, models, refresh } = useStatusStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cards: Array<{ label: string; online: boolean | null; detail?: string }> = [
    {
      label: t('status.backend'),
      online: health ? health.status === 'ok' || health.status === 'degraded' : null,
      detail: health ? `${health.service} · v${health.version}` : undefined,
    },
    { label: t('status.database'), online: health ? health.database === 'online' : null },
    { label: t('status.redis'), online: health ? health.redis === 'online' : null },
    {
      label: t('status.ollama'),
      online: ollama ? ollama.status === 'online' : null,
      detail:
        ollama?.status === 'online' && ollama.latencyMs !== undefined
          ? `${t('status.latency')}: ${ollama.latencyMs} ms`
          : ollama?.error,
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-zrh-gold sm:text-2xl">{t('status.system')}</h1>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-zrh-gold/40 px-3 py-1.5 text-sm text-zrh-gold transition-colors hover:bg-zrh-gold/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          {t('status.refresh')}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-zrh-err/40 bg-zrh-err/10 px-4 py-3 text-sm text-zrh-err">
          {t('status.error')}: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-zrh-border bg-zrh-surface p-4">
            <p className="text-xs text-zrh-text-dim sm:text-sm">{card.label}</p>
            <p className="mt-2 text-sm sm:text-base">
              <StatusBadge online={card.online} />
            </p>
            {card.detail && <p className="mt-1 break-all text-xs text-zrh-text-dim">{card.detail}</p>}
          </div>
        ))}
      </div>

      {health && (
        <p className="text-xs text-zrh-text-dim">
          {t('status.timestamp')}: {health.timestamp}
        </p>
      )}

      <div className="rounded-xl border border-zrh-border bg-zrh-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-zrh-gold sm:text-base">
          {t('status.models')}
        </h2>
        {!models && <p className="text-sm text-zrh-text-dim">{t('status.loading')}</p>}
        {models && models.status === 'offline' && (
          <p className="text-sm text-zrh-err">
            {t('status.offline')}: {models.error}
          </p>
        )}
        {models && models.status === 'online' && (
          <ul className="divide-y divide-zrh-border">
            {models.models.map((m) => (
              <li key={m.digest || m.name} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm text-zrh-text">{m.name}</span>
                <span className="text-xs text-zrh-text-dim">
                  {(m.size / 1024 / 1024 / 1024).toFixed(1)} GB
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.section>
  );
}
