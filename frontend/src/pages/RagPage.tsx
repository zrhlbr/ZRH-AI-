import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { BrainCircuit, Search, Sparkles, FileText, Link2, Timer, Percent } from 'lucide-react';
import { ZButton, ZCard, ZInput, ZBadge, ZTabs } from '../components/ui';
import { TechBackground } from '../components/background/TechBackground';
import { fadeInUp, baseTransition } from '../design-system/animations';
import { ragApi, RagAskResult, RagCitation, RagHealth } from '../api/rag';
import { useAuthStore } from '../store/authStore';

export function RagPage() {
  const { t } = useTranslation();
  const canWrite = useAuthStore((s) => s.hasPermission('api:rag:write'));

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'keyword' | 'semantic' | 'hybrid'>('hybrid');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RagAskResult | null>(null);
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [health, setHealth] = useState<RagHealth | null>(null);
  const [searchOnly, setSearchOnly] = useState<{
    latencyMs: number;
    hitRate: number;
    citations: RagCitation[];
    relatedDocuments: Array<{ id: number; title: string; filename: string; score: number }>;
  } | null>(null);

  useEffect(() => {
    void ragApi.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  const ask = async () => {
    if (!query.trim() || !canWrite) return;
    setLoading(true);
    setError(null);
    setSearchOnly(null);
    try {
      const data = await ragApi.ask({
        query: query.trim(),
        mode,
        conversationId,
        topK: 20,
      });
      setResult(data);
      setConversationId(data.conversationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await ragApi.search(query.trim(), mode, 20);
      setSearchOnly({
        latencyMs: data.latencyMs,
        hitRate: data.hitRate,
        citations: data.citations,
        relatedDocuments: data.relatedDocuments,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const citations = result?.citations ?? searchOnly?.citations ?? [];
  const related = result?.relatedDocuments ?? searchOnly?.relatedDocuments ?? [];
  const metrics = result?.metrics;
  const latency = metrics?.totalMs ?? searchOnly?.latencyMs;
  const hitRate = metrics?.hitRate ?? searchOnly?.hitRate;

  const tabs = [
    {
      key: 'ask',
      label: (
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4" /> {t('rag.ask')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <ZInput
              placeholder={t('rag.queryPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void ask()}
              className="flex-1"
            />
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
              className="rounded-lg border border-zrh-border bg-zrh-surface px-3 py-2 text-sm text-zrh-text"
            >
              <option value="hybrid">{t('rag.modes.hybrid')}</option>
              <option value="semantic">{t('rag.modes.semantic')}</option>
              <option value="keyword">{t('rag.modes.keyword')}</option>
            </select>
            <ZButton onClick={() => void ask()} loading={loading} disabled={!canWrite || !query.trim()}>
              <BrainCircuit className="h-4 w-4" />
              {t('rag.askAction')}
            </ZButton>
            <ZButton variant="secondary" onClick={() => void search()} loading={loading} disabled={!query.trim()}>
              <Search className="h-4 w-4" />
              {t('rag.searchAction')}
            </ZButton>
          </div>

          {result?.rewrittenQuery && (
            <p className="text-xs text-zrh-text-dim">
              {t('rag.rewritten')}: <span className="text-zrh-text">{result.rewrittenQuery}</span>
            </p>
          )}

          {(latency !== undefined || hitRate !== undefined) && (
            <div className="flex flex-wrap gap-3 text-xs text-zrh-text-dim">
              <span className="inline-flex items-center gap-1">
                <Timer className="h-3.5 w-3.5 text-zrh-accent" />
                {t('rag.latency')}: {latency ?? 0} ms
              </span>
              <span className="inline-flex items-center gap-1">
                <Percent className="h-3.5 w-3.5 text-zrh-accent" />
                {t('rag.hitRate')}: {((hitRate ?? 0) * 100).toFixed(1)}%
              </span>
              {metrics && (
                <>
                  <ZBadge tone="dim">retrieve {metrics.retrieveCount}</ZBadge>
                  <ZBadge tone="dim">rerank {metrics.rerankCount}</ZBadge>
                  <ZBadge tone="dim">citations {metrics.citationCount}</ZBadge>
                </>
              )}
            </div>
          )}

          {result?.answer && (
            <div className="rounded-lg border border-zrh-border bg-zrh-surface-raised/40 p-4">
              <h3 className="mb-2 text-sm font-semibold text-zrh-accent">{t('rag.answer')}</h3>
              <pre className="whitespace-pre-wrap text-sm text-zrh-text">{result.answer}</pre>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'citations',
      label: (
        <span className="flex items-center gap-1.5">
          <Link2 className="h-4 w-4" /> {t('rag.citations')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-3">
          {citations.length === 0 && <p className="text-sm text-zrh-text-dim">{t('rag.noCitations')}</p>}
          {citations.map((c) => (
            <div key={`${c.chunkId}-${c.index}`} className="rounded-lg border border-zrh-border p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zrh-text">
                  [#{c.index}] {c.title}
                </span>
                <ZBadge tone="accent">{(c.score * 100).toFixed(1)}%</ZBadge>
              </div>
              <p className="text-xs text-zrh-text-dim">
                {c.filename}
                {c.page ? ` · p.${c.page}` : ''} · chunk {c.chunkIndex}
              </p>
              <p className="mt-2 text-sm text-zrh-text">{c.snippet}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'related',
      label: (
        <span className="flex items-center gap-1.5">
          <FileText className="h-4 w-4" /> {t('rag.related')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-2">
          {related.length === 0 && <p className="text-sm text-zrh-text-dim">{t('rag.noRelated')}</p>}
          {related.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-zrh-border px-3 py-2">
              <div>
                <p className="text-sm text-zrh-text">{d.title}</p>
                <p className="text-xs text-zrh-text-dim">{d.filename}</p>
              </div>
              <ZBadge tone="dim">{(d.score * 100).toFixed(1)}%</ZBadge>
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
            <BrainCircuit className="h-6 w-6 text-zrh-accent" />
            <h1 className="text-lg font-bold tracking-wider text-zrh-accent">{t('rag.title')}</h1>
          </div>
          <p className="mt-1 text-xs text-zrh-text-dim sm:text-sm">{t('rag.subtitle')}</p>
        </motion.div>

        {health && (
          <div className="flex flex-wrap gap-2 text-xs text-zrh-text-dim">
            <ZBadge tone={health.embedding.ok ? 'ok' : 'err'}>Embedding</ZBadge>
            <ZBadge tone={health.vector.ok ? 'ok' : 'err'}>Vector:{health.vector.provider}</ZBadge>
            <ZBadge tone={health.retriever.ok ? 'ok' : 'err'}>Retriever</ZBadge>
            <span>{t('rag.pendingTasks')}: {health.pendingEmbeddingTasks}</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</div>
        )}

        <ZCard className="flex-1">
          <ZTabs tabs={tabs} defaultKey="ask" />
        </ZCard>
      </div>
    </TechBackground>
  );
}
