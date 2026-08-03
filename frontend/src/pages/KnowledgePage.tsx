import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Folder,
  FolderOpen,
  Search,
  UploadCloud,
  Trash2,
  RefreshCw,
  Plus,
  FileText,
  Heart,
  RotateCcw,
  Cpu,
  Download,
  Eye,
  Activity,
} from 'lucide-react';
import { ZButton, ZCard, ZInput, ZBadge, ZTable, ZTabs } from '../components/ui';
import { TechBackground } from '../components/background/TechBackground';
import { fadeInUp, baseTransition } from '../design-system/animations';
import { BrandMark } from '../design-system/BrandMark';
import {
  knowledgeApi,
  KnowledgeDocumentItem,
  KnowledgeFolder,
  KnowledgeHealth,
  SearchResultItem,
  DocumentStatus,
} from '../api/knowledge';
import { useAuthStore } from '../store/authStore';

function formatBytes(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v <= 0) return '—';
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / 1024 / 1024).toFixed(1)} MB`;
}

function statusTone(status: DocumentStatus): 'accent' | 'ok' | 'warn' | 'err' | 'dim' {
  switch (status) {
    case 'indexed':
      return 'ok';
    case 'chunked':
      return 'accent';
    case 'embedding':
    case 'parsing':
      return 'warn';
    case 'error':
      return 'err';
    default:
      return 'dim';
  }
}

export function KnowledgePage() {
  const { t } = useTranslation();
  const { hasPermission } = useAuthStore();
  const canWrite = hasPermission('api:knowledge:write');
  const canDelete = hasPermission('api:knowledge:delete');
  const canAdmin = hasPermission('api:knowledge:admin');

  const [folders, setFolders] = useState<KnowledgeFolder[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeFolderId, setActiveFolderId] = useState<number | undefined>(undefined);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const [showTrash, setShowTrash] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMeta, setUploadMeta] = useState({ title: '', author: '', source: '', permission: 'private' as const });
  const [uploading, setUploading] = useState(false);

  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'keyword' | 'semantic' | 'hybrid'>('hybrid');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);
  const [health, setHealth] = useState<KnowledgeHealth | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [f, d, h] = await Promise.all([
        knowledgeApi.listFolders(),
        knowledgeApi.listDocuments({
          folderId: showTrash ? undefined : activeFolderId,
          search: searchKeyword || undefined,
          favorite: !showTrash && onlyFavorite ? true : undefined,
          trash: showTrash || undefined,
        }),
        knowledgeApi.status().catch(() => null),
      ]);
      setFolders(f);
      setDocuments(d.items);
      if (h) setHealth(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [activeFolderId, onlyFavorite, showTrash]);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  const folderMap = useMemo(() => {
    const map = new Map<number, KnowledgeFolder>();
    for (const f of folders) map.set(f.id, f);
    return map;
  }, [folders]);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setError(null);
    try {
      await knowledgeApi.upload(uploadFile, {
        folderId: activeFolderId,
        title: uploadMeta.title || undefined,
        author: uploadMeta.author || undefined,
        source: uploadMeta.source || undefined,
        permission: uploadMeta.permission,
      });
      setUploadFile(null);
      setUploadMeta({ title: '', author: '', source: '', permission: 'private' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await knowledgeApi.createFolder({ name: newFolderName.trim(), parentId: activeFolderId });
      setNewFolderName('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (id: number) => {
    if (!window.confirm(t('knowledge.deleteFolderConfirm'))) return;
    try {
      await knowledgeApi.deleteFolder(id);
      if (activeFolderId === id) setActiveFolderId(undefined);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleToggleFavorite = async (doc: KnowledgeDocumentItem) => {
    try {
      await knowledgeApi.updateDocument(doc.id, { isFavorite: !doc.isFavorite });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDeleteDocument = async (doc: KnowledgeDocumentItem) => {
    if (showTrash) {
      if (!window.confirm(t('knowledge.deletePermanentConfirm'))) return;
      try {
        await knowledgeApi.deleteDocument(doc.id, true);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      return;
    }
    if (!window.confirm(t('knowledge.moveToTrashConfirm'))) return;
    try {
      await knowledgeApi.deleteDocument(doc.id, false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRestoreDocument = async (doc: KnowledgeDocumentItem) => {
    try {
      await knowledgeApi.restoreDocument(doc.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handlePreview = async (id: number) => {
    try {
      const data = await knowledgeApi.previewDocument(id);
      setPreview({ title: data.title, content: data.content });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDownload = async (id: number) => {
    try {
      const { blob, filename } = await knowledgeApi.downloadDocument(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await knowledgeApi.search(query.trim(), mode, 10);
      setSearchResults(res.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  };

  const handleParse = async (id: number) => {
    try {
      await knowledgeApi.parseDocument(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleReindex = async (id: number) => {
    try {
      await knowledgeApi.reindexDocument(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const folderBreadcrumb = useMemo(() => {
    const items: KnowledgeFolder[] = [];
    let cur = activeFolderId ? folderMap.get(activeFolderId) : undefined;
    while (cur) {
      items.unshift(cur);
      cur = cur.parentId ? folderMap.get(cur.parentId) : undefined;
    }
    return items;
  }, [activeFolderId, folderMap]);

  const documentColumns = [
    { key: 'title', header: t('knowledge.docTitle'), render: (d: KnowledgeDocumentItem) => (
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-zrh-accent" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zrh-text">{d.title}</p>
          <p className="truncate text-[11px] text-zrh-text-dim">{d.filename}</p>
        </div>
      </div>
    )},
    { key: 'status', header: t('knowledge.status'), render: (d: KnowledgeDocumentItem) => (
      <ZBadge tone={statusTone(d.status)}>{t(`knowledge.statuses.${d.status}`)}</ZBadge>
    )},
    { key: 'size', header: t('knowledge.size'), render: (d: KnowledgeDocumentItem) => <span className="text-zrh-text-dim">{formatBytes(d.sizeBytes)}</span> },
    { key: 'updated', header: t('knowledge.updated'), render: (d: KnowledgeDocumentItem) => (
      <span className="text-zrh-text-dim">{new Date(d.updatedAt).toLocaleString()}</span>
    )},
    { key: 'actions', header: t('knowledge.actions'), className: 'text-right', render: (d: KnowledgeDocumentItem) => (
      <div className="flex items-center justify-end gap-1">
        {!showTrash && (
          <>
            <button
              type="button"
              onClick={() => void handleToggleFavorite(d)}
              className={`rounded p-1 ${d.isFavorite ? 'text-red-400' : 'text-zrh-text-dim hover:text-zrh-text'}`}
              title={t('knowledge.favorite')}
            >
              <Heart className="h-4 w-4" fill={d.isFavorite ? 'currentColor' : 'none'} />
            </button>
            <ZButton variant="ghost" size="sm" onClick={() => void handlePreview(d.id)} title={t('knowledge.preview')}>
              <Eye className="h-3.5 w-3.5" />
            </ZButton>
            <ZButton variant="ghost" size="sm" onClick={() => void handleDownload(d.id)} title={t('knowledge.download')}>
              <Download className="h-3.5 w-3.5" />
            </ZButton>
            {canAdmin && d.status !== 'parsing' && d.status !== 'embedding' && (
              <>
                <ZButton variant="ghost" size="sm" onClick={() => void handleParse(d.id)} title={t('knowledge.parse')}>
                  <Cpu className="h-3.5 w-3.5" />
                </ZButton>
                <ZButton variant="ghost" size="sm" onClick={() => void handleReindex(d.id)} title={t('knowledge.reindex')}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </ZButton>
              </>
            )}
          </>
        )}
        {showTrash && canWrite && (
          <ZButton variant="ghost" size="sm" onClick={() => void handleRestoreDocument(d)} title={t('knowledge.restore')}>
            <RotateCcw className="h-3.5 w-3.5" />
          </ZButton>
        )}
        {canDelete && (
          <ZButton variant="ghost" size="sm" onClick={() => void handleDeleteDocument(d)} title={t('knowledge.delete')}>
            <Trash2 className="h-3.5 w-3.5" />
          </ZButton>
        )}
      </div>
    )},
  ];

  const tabs = [
    {
      key: 'documents',
      label: (
        <span className="flex items-center gap-1.5">
          <FileText className="h-4 w-4" /> {t('knowledge.documents')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-4">
          {/* 面包屑与工具栏 */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1 text-sm text-zrh-text-dim">
              <button
                type="button"
                onClick={() => setActiveFolderId(undefined)}
                className={`rounded px-2 py-1 ${activeFolderId === undefined ? 'bg-zrh-surface-raised text-zrh-text' : 'hover:text-zrh-text'}`}
              >
                {t('knowledge.root')}
              </button>
              {folderBreadcrumb.map((f) => (
                <span key={f.id} className="flex items-center gap-1">
                  <span>/</span>
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(f.id)}
                    className={`rounded px-2 py-1 ${activeFolderId === f.id ? 'bg-zrh-surface-raised text-zrh-text' : 'hover:text-zrh-text'}`}
                  >
                    {f.name}
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {!showTrash && (
                <ZButton variant={onlyFavorite ? 'secondary' : 'ghost'} size="sm" onClick={() => setOnlyFavorite((v) => !v)}>
                  <Heart className="h-3.5 w-3.5" fill={onlyFavorite ? 'currentColor' : 'none'} />
                  {t('knowledge.favorites')}
                </ZButton>
              )}
              <ZButton
                variant={showTrash ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => {
                  setShowTrash((v) => !v);
                  setOnlyFavorite(false);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('knowledge.trash')}
              </ZButton>
              <ZButton variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                {t('status.refresh')}
              </ZButton>
            </div>
          </div>

          <ZInput
            placeholder={t('knowledge.searchDocuments')}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />

          <ZTable
            columns={documentColumns}
            data={documents}
            rowKey={(d) => d.id}
            emptyText={loading ? t('knowledge.loading') : t('knowledge.noDocuments')}
          />
        </div>
      ),
    },
    {
      key: 'folders',
      label: (
        <span className="flex items-center gap-1.5">
          <Folder className="h-4 w-4" /> {t('knowledge.folders')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-4">
          {canWrite && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <ZInput
                placeholder={t('knowledge.newFolderPlaceholder')}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="sm:min-w-[240px]"
              />
              <ZButton onClick={() => void handleCreateFolder()} loading={creatingFolder} disabled={!newFolderName.trim()}>
                <Plus className="h-4 w-4" />
                {t('knowledge.createFolder')}
              </ZButton>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg border border-zrh-border bg-zrh-surface-raised/40 p-3 hover:border-zrh-accent/30"
              >
                <button
                  type="button"
                  onClick={() => setActiveFolderId(f.id)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <FolderOpen className="h-4 w-4 text-zrh-accent" />
                  <span className="text-sm font-medium text-zrh-text">{f.name}</span>
                </button>
                {canDelete && (
                  <ZButton variant="ghost" size="sm" onClick={() => void handleDeleteFolder(f.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </ZButton>
                )}
              </div>
            ))}
            {folders.length === 0 && !loading && (
              <p className="col-span-full text-sm text-zrh-text-dim">{t('knowledge.noFolders')}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'upload',
      label: (
        <span className="flex items-center gap-1.5">
          <UploadCloud className="h-4 w-4" /> {t('knowledge.upload')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-4">
          <ZCard title={t('knowledge.uploadTitle')}>
            <div className="flex flex-col gap-4">
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-zrh-text file:mr-4 file:rounded-lg file:border-0 file:bg-zrh-accent file:px-4 file:py-2 file:text-xs file:font-semibold file:text-zrh-bg hover:file:bg-zrh-accent-soft"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <ZInput
                  label={t('knowledge.title')}
                  placeholder={t('knowledge.titlePlaceholder')}
                  value={uploadMeta.title}
                  onChange={(e) => setUploadMeta((m) => ({ ...m, title: e.target.value }))}
                />
                <ZInput
                  label={t('knowledge.author')}
                  placeholder={t('knowledge.authorPlaceholder')}
                  value={uploadMeta.author}
                  onChange={(e) => setUploadMeta((m) => ({ ...m, author: e.target.value }))}
                />
                <ZInput
                  label={t('knowledge.source')}
                  placeholder={t('knowledge.sourcePlaceholder')}
                  value={uploadMeta.source}
                  onChange={(e) => setUploadMeta((m) => ({ ...m, source: e.target.value }))}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-zrh-text-dim sm:text-sm">{t('knowledge.permission')}</label>
                  <select
                    value={uploadMeta.permission}
                    onChange={(e) => setUploadMeta((m) => ({ ...m, permission: e.target.value as any }))}
                    className="w-full rounded-lg border border-zrh-border bg-zrh-surface px-3.5 py-2.5 text-sm text-zrh-text outline-none"
                  >
                    <option value="private">{t('knowledge.permissions.private')}</option>
                    <option value="public">{t('knowledge.permissions.public')}</option>
                    <option value="company">{t('knowledge.permissions.company')}</option>
                    <option value="department">{t('knowledge.permissions.department')}</option>
                    <option value="role">{t('knowledge.permissions.role')}</option>
                  </select>
                </div>
              </div>
              <ZButton onClick={() => void handleUpload()} loading={uploading} disabled={!uploadFile}>
                <UploadCloud className="h-4 w-4" />
                {t('knowledge.startUpload')}
              </ZButton>
            </div>
          </ZCard>
        </div>
      ),
    },
    {
      key: 'search',
      label: (
        <span className="flex items-center gap-1.5">
          <Search className="h-4 w-4" /> {t('knowledge.search')}
        </span>
      ),
      content: (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <ZInput
              placeholder={t('knowledge.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
              className="flex-1"
            />
            <div className="flex items-center gap-2">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="rounded-lg border border-zrh-border bg-zrh-surface px-3 py-2 text-sm text-zrh-text outline-none"
              >
                <option value="hybrid">{t('knowledge.modes.hybrid')}</option>
                <option value="semantic">{t('knowledge.modes.semantic')}</option>
                <option value="keyword">{t('knowledge.modes.keyword')}</option>
              </select>
              <ZButton onClick={() => void handleSearch()} loading={searching} disabled={!query.trim()}>
                <Search className="h-4 w-4" />
                {t('knowledge.searchAction')}
              </ZButton>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="flex flex-col gap-3">
              {searchResults.map((r, idx) => (
                <div key={`${r.chunkId}-${idx}`} className="rounded-lg border border-zrh-border bg-zrh-surface-raised/40 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-zrh-accent">{r.document?.title || `ID:${r.documentId}`}</span>
                    <ZBadge tone="dim">{r.source} · {(r.score * 100).toFixed(1)}%</ZBadge>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-zrh-text">{r.content}</p>
                </div>
              ))}
            </div>
          )}
          {!searching && query && searchResults.length === 0 && (
            <p className="text-sm text-zrh-text-dim">{t('knowledge.noSearchResults')}</p>
          )}
        </div>
      ),
    },
  ];

  return (
    <TechBackground>
      <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 px-3 py-5 sm:px-5">
        <motion.div variants={fadeInUp} initial="initial" animate="animate" transition={baseTransition}>
          <div className="flex items-center gap-3">
            <BrandMark size={32} className="h-8 w-8 rounded-lg" />
            <h1 className="text-lg font-bold tracking-wider text-zrh-accent">{t('knowledge.title')}</h1>
          </div>
          <p className="mt-1 text-xs text-zrh-text-dim sm:text-sm">{t('knowledge.subtitle')}</p>
        </motion.div>

        {health && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zrh-border bg-zrh-surface-raised/40 px-3 py-2 text-xs text-zrh-text-dim">
            <span className="inline-flex items-center gap-1 text-zrh-text">
              <Activity className="h-3.5 w-3.5 text-zrh-accent" />
              {t('knowledge.health')}
            </span>
            <span>{t('knowledge.documents')}: {health.documents}</span>
            <span>Chunks: {health.chunks}</span>
            <span>Vectors: {health.vectors}</span>
            <ZBadge tone={health.embedding.ok ? 'ok' : 'err'}>Embedding</ZBadge>
            <ZBadge tone={health.vector.ok ? 'ok' : 'err'}>Vector</ZBadge>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {preview && (
          <div className="rounded-lg border border-zrh-border bg-zrh-surface-raised/60 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zrh-text">{preview.title}</h2>
              <ZButton variant="ghost" size="sm" onClick={() => setPreview(null)}>{t('common.close')}</ZButton>
            </div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs text-zrh-text-dim sm:text-sm">{preview.content}</pre>
          </div>
        )}

        <ZCard className="flex-1">
          <ZTabs tabs={tabs} defaultKey="documents" />
        </ZCard>
      </div>
    </TechBackground>
  );
}
