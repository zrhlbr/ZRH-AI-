import { request, ApiError } from './client';
import { useAuthStore } from '../store/authStore';

/**
 * AI 对话核心 API（阶段 3）
 * 普通接口走统一 request()；流式接口走 fetch + ReadableStream 解析 SSE。
 */

export interface ConversationItem {
  id: number;
  title: string;
  model: string;
  pinned: boolean;
  favorite: boolean;
  folderId: number | null;
  messageCount: number;
  preview: string;
  createdAt: string;
  lastMessageAt: string;
}

export interface ConversationListResult {
  page: number;
  pageSize: number;
  total: number;
  items: ConversationItem[];
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number | null;
  status: 'done' | 'stopped' | 'error';
  feedback: 'like' | 'dislike' | null;
  createdAt: string;
}

export interface ConversationDetail {
  conversation: {
    id: number;
    title: string;
    model: string;
    pinned: boolean;
    favorite: boolean;
    promptCode: string | null;
    systemPrompt: string | null;
    folderId: number | null;
    createdAt: string;
    lastMessageAt: string;
  };
  messages: ChatMessage[];
  hasMore: boolean;
}

export interface ChatModelInfo {
  name: string;
  displayName: string;
  enabled: boolean;
  isDefault: boolean;
  installed: boolean;
  sizeBytes: number | null;
}

export type ModelRuntimeStatus = 'online' | 'loading' | 'running' | 'stopped' | 'error';

export interface ChatModelStatus {
  name: string;
  displayName: string;
  status: ModelRuntimeStatus;
  installed: boolean;
  vramBytes: number | null;
}

export interface ChatParams {
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  contextLength: number;
  maxTokens: number;
  seed: number | null;
}

export interface PromptTemplate {
  id: number;
  code: string;
  name: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  isDefault: boolean;
}

export interface ChatStats {
  conversations: number;
  messages: number;
  models: number;
  activeGenerations: number;
}

/** SSE 事件 */
export type ChatStreamEvent =
  | { type: 'meta'; conversationId: number; userMessageId?: number; appendToMessageId?: number; replacedMessageId?: number; model: string }
  | { type: 'delta'; content: string }
  | { type: 'done'; conversationId: number; messageId: number | null; status: 'done' | 'stopped'; promptTokens?: number | null; completionTokens?: number | null; durationMs?: number | null }
  | { type: 'error'; message: string };

export const chatApi = {
  listConversations: (params: { page?: number; pageSize?: number; search?: string; pinned?: boolean; favorite?: boolean }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params.search) qs.set('search', params.search);
    if (params.pinned) qs.set('pinned', '1');
    if (params.favorite) qs.set('favorite', '1');
    const suffix = qs.toString();
    return request<ConversationListResult>(`/chat/list${suffix ? `?${suffix}` : ''}`);
  },

  getConversation: (id: number, opts: { limit?: number; before?: number } = {}) => {
    const qs = new URLSearchParams();
    if (opts.limit) qs.set('limit', String(opts.limit));
    if (opts.before) qs.set('before', String(opts.before));
    const suffix = qs.toString();
    return request<ConversationDetail>(`/chat/${id}${suffix ? `?${suffix}` : ''}`);
  },

  updateConversation: (id: number, data: Partial<{ title: string; pinned: boolean; favorite: boolean; folderId: number | null; model: string; systemPrompt: string; promptCode: string }>) =>
    request<ConversationDetail['conversation']>(`/chat/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteConversation: (id: number) =>
    request<{ deleted: boolean }>(`/chat/${id}`, { method: 'DELETE' }),

  stop: (conversationId: number) =>
    request<{ stopped: boolean }>('/chat/stop', { method: 'POST', body: JSON.stringify({ conversationId }) }),

  updateMessage: (id: number, feedback: 'like' | 'dislike' | null) =>
    request<ChatMessage>(`/chat/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ feedback }) }),

  deleteMessage: (id: number) =>
    request<{ deleted: boolean }>(`/chat/messages/${id}`, { method: 'DELETE' }),

  models: () => request<{ ollama: 'online' | 'offline'; models: ChatModelInfo[] }>('/chat/models'),
  modelsStatus: () => request<{ ollama: 'online' | 'offline'; models: ChatModelStatus[] }>('/chat/models/status'),

  getParams: () => request<ChatParams>('/chat/parameters'),
  saveParams: (data: Partial<ChatParams>) =>
    request<ChatParams>('/chat/parameters', { method: 'PATCH', body: JSON.stringify(data) }),

  prompts: () => request<PromptTemplate[]>('/chat/prompts'),
  stats: () => request<ChatStats>('/chat/stats'),
};

/** 导出对话（带鉴权下载） */
export async function exportConversation(id: number, format: 'md' | 'json'): Promise<void> {
  const { accessToken } = useAuthStore.getState();
  const response = await fetch(`/api/v1/chat/${id}/export?format=${format}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok) throw new ApiError(response.status, `export failed: HTTP ${response.status}`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zrh-ai-chat-${id}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface StreamChatOptions {
  conversationId?: number;
  message?: string;
  model?: string;
  promptCode?: string;
  continue?: boolean;
  regenerate?: boolean;
  signal: AbortSignal;
  onEvent: (event: ChatStreamEvent) => void;
}

/**
 * SSE 流式聊天：POST /chat 或 POST /chat/regenerate。
 * 逐行解析 `data: {...}` 帧并回调；401 时先刷新 token 重试一次。
 */
export async function streamChat(opts: StreamChatOptions): Promise<void> {
  const attempt = async (): Promise<Response> => {
    const { accessToken } = useAuthStore.getState();
    const path = opts.regenerate ? '/chat/regenerate' : '/chat';
    const body = opts.regenerate
      ? { conversationId: opts.conversationId }
      : {
          conversationId: opts.conversationId,
          message: opts.message,
          model: opts.model,
          promptCode: opts.promptCode,
          continue: opts.continue,
        };
    return fetch(`/api/v1${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  };

  let response = await attempt();
  if (response.status === 401) {
    // token 过期：走统一刷新流程后重试
    const { refreshToken, setTokens, clear } = useAuthStore.getState();
    if (refreshToken) {
      try {
        const data = await request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
        setTokens(data.accessToken, data.refreshToken);
        response = await attempt();
      } catch {
        clear();
      }
    }
  }

  if (!response.ok || !response.body) {
    throw new ApiError(response.status, `stream failed: HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith('data:')) continue;
      try {
        opts.onEvent(JSON.parse(line.slice(5).trim()) as ChatStreamEvent);
      } catch {
        // 忽略不完整帧
      }
    }
  }
}
