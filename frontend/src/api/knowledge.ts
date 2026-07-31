import { ApiError, request } from './client';
import { useAuthStore } from '../store/authStore';

export type PermissionScope = 'public' | 'company' | 'department' | 'private' | 'role';
export type DocumentStatus = 'pending' | 'parsing' | 'chunked' | 'embedding' | 'indexed' | 'error';

export interface KnowledgeTag {
  id: number;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface KnowledgeFolder {
  id: number;
  name: string;
  parentId: number | null;
  ownerId: number;
  permission: PermissionScope;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocumentItem {
  id: number;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  isFavorite: boolean;
  isDeleted?: boolean;
  permission: PermissionScope;
  author: string | null;
  source: string | null;
  language: string | null;
  folderId: number | null;
  folder: KnowledgeFolder | null;
  tags: KnowledgeTag[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListResult {
  page: number;
  pageSize: number;
  total: number;
  items: KnowledgeDocumentItem[];
}

export interface UploadResult {
  documentId: number;
  versionId: number;
  taskId: number;
  title: string;
  status: string;
}

export interface SearchResultItem {
  chunkId: number;
  documentId: number;
  content: string;
  score: number;
  source: 'keyword' | 'semantic' | 'hybrid';
  document?: {
    id: number;
    title: string;
    filename: string;
  };
}

export interface KnowledgeHealth {
  documents: number;
  chunks: number;
  vectors: number;
  parser: { ok: boolean; supportedFormats: string[]; error?: string };
  embedding: { ok: boolean; provider: string; latencyMs?: number; error?: string };
  vector: { ok: boolean; provider: string; count?: number; error?: string };
}

export const knowledgeApi = {
  // Folders
  listFolders: (parentId?: number) =>
    request<KnowledgeFolder[]>(`/knowledge/folders${parentId !== undefined ? `?parentId=${parentId}` : ''}`),
  createFolder: (data: { name: string; parentId?: number; permission?: PermissionScope }) =>
    request<KnowledgeFolder>('/knowledge/folders', { method: 'POST', body: JSON.stringify(data) }),
  updateFolder: (id: number, data: { name?: string; parentId?: number | null; permission?: PermissionScope }) =>
    request<KnowledgeFolder>(`/knowledge/folders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteFolder: (id: number) =>
    request<{ deleted: boolean }>(`/knowledge/folders/${id}`, { method: 'DELETE' }),

  // Documents
  listDocuments: (params: {
    folderId?: number;
    search?: string;
    status?: DocumentStatus;
    favorite?: boolean;
    trash?: boolean;
    page?: number;
    pageSize?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.folderId !== undefined) qs.set('folderId', String(params.folderId));
    if (params.search) qs.set('search', params.search);
    if (params.status) qs.set('status', params.status);
    if (params.favorite) qs.set('favorite', 'true');
    if (params.trash) qs.set('trash', 'true');
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    const suffix = qs.toString();
    return request<DocumentListResult>(`/knowledge/documents${suffix ? `?${suffix}` : ''}`);
  },
  getDocument: (id: number) => request<KnowledgeDocumentItem>(`/knowledge/documents/${id}`),
  previewDocument: (id: number, maxLength = 1000) =>
    request<{ title: string; content: string; language?: string; pages?: number }>(
      `/knowledge/documents/${id}/preview?maxLength=${maxLength}`,
      { timeoutMs: 30000 },
    ),
  updateDocument: (
    id: number,
    data: Partial<{
      title: string;
      folderId: number | null;
      tag: number;
      isFavorite: boolean;
      permission: PermissionScope;
      author: string;
      source: string;
    }>,
  ) => request<KnowledgeDocumentItem>(`/knowledge/documents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  moveDocument: (id: number, folderId?: number | null) =>
    request<KnowledgeDocumentItem>(`/knowledge/documents/${id}/move`, { method: 'POST', body: JSON.stringify({ folderId }) }),
  copyDocument: (id: number, targetFolderId?: number) =>
    request<KnowledgeDocumentItem>(`/knowledge/documents/${id}/copy`, { method: 'POST', body: JSON.stringify({ targetFolderId }) }),
  deleteDocument: (id: number, permanent = false) =>
    request<{ deleted: boolean }>(`/knowledge/documents/${id}?permanent=${permanent}`, { method: 'DELETE' }),
  restoreDocument: (id: number) =>
    request<KnowledgeDocumentItem>(`/knowledge/documents/${id}/restore`, { method: 'POST' }),
  parseDocument: (id: number) =>
    request<{ documentId: number; status: string }>(`/knowledge/documents/${id}/parse`, { method: 'POST', timeoutMs: 120000 }),
  reindexDocument: (id: number) =>
    request<{ documentId: number; status: string }>(`/knowledge/documents/${id}/reindex`, { method: 'POST', timeoutMs: 120000 }),

  downloadDocument: async (id: number): Promise<{ blob: Blob; filename: string }> => {
    const { accessToken } = useAuthStore.getState();
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetch(`/api/v1/knowledge/documents/${id}/download`, {
      headers,
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) {
      const envelope = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new ApiError(response.status, envelope?.message ?? `HTTP ${response.status}`);
    }
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
    const filename = match ? decodeURIComponent(match[1].replace(/"/g, '')) : `document-${id}`;
    return { blob: await response.blob(), filename };
  },

  // Upload（解析链路较长，单独放宽超时）
  upload: (file: File, opts: {
    folderId?: number;
    title?: string;
    author?: string;
    source?: string;
    tags?: number[];
    permission?: PermissionScope;
  } = {}) => {
    const form = new FormData();
    form.append('file', file);
    if (opts.folderId !== undefined) form.append('folderId', String(opts.folderId));
    if (opts.title) form.append('title', opts.title);
    if (opts.author) form.append('author', opts.author);
    if (opts.source) form.append('source', opts.source);
    if (opts.tags?.length) form.append('tags', opts.tags.join(','));
    if (opts.permission) form.append('permission', opts.permission);
    return request<UploadResult>('/knowledge/upload', { method: 'POST', body: form, timeoutMs: 180000 });
  },

  // Tags
  listTags: () => request<KnowledgeTag[]>('/knowledge/tags'),
  createTag: (name: string, color?: string) =>
    request<KnowledgeTag>('/knowledge/tags', { method: 'POST', body: JSON.stringify({ name, color }) }),

  // Search
  search: (query: string, mode: 'keyword' | 'semantic' | 'hybrid' = 'hybrid', topK = 10) =>
    request<{ query: string; mode: string; topK: number; results: SearchResultItem[] }>(
      `/knowledge/search?query=${encodeURIComponent(query)}&mode=${mode}&topK=${topK}`,
      { timeoutMs: 60000 },
    ),

  // Health / Status
  status: () => request<KnowledgeHealth>('/knowledge/status'),
  formats: () => request<Array<{ mimeType: string; extensions: string[] }> | { formats: string[] }>('/knowledge/formats'),
};
