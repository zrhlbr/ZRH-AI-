import { request } from './client';

export interface AIProviderInfo {
  code: string;
  enabled: boolean;
  supportsPull: boolean;
  supportsDelete: boolean;
  supportsEmbeddings: boolean;
  supportsToolCall: boolean;
}

export interface AIModelInfo {
  name: string;
  displayName: string;
  providerCode: string;
  description?: string;
  sizeBytes: number | null;
  digest: string | null;
  status: string;
  enabled: boolean;
  isDefault: boolean;
  contextLength: number;
  capabilities: string[];
}

export interface AIProviderHealth {
  status: 'online' | 'offline' | 'error';
  latencyMs?: number;
  error?: string;
  checkedAt: string;
}

export interface AIRouterDecision {
  providerCode: string;
  modelName: string;
  reason: string;
}

export interface AIPullProgress {
  status: 'pulling' | 'complete' | 'error';
  completed?: number;
  total?: number;
  digest?: string;
  error?: string;
}

export const aiApi = {
  providers: () => request<{ providers: AIProviderInfo[] }>('/ai/providers'),
  providerHealth: (providerCode: string) => request<AIProviderHealth>(`/ai/providers/${providerCode}/health`),
  syncProvider: (providerCode: string) => request<{ synced: number }>(`/ai/providers/${providerCode}/sync`, { method: 'POST' }),

  models: () => request<AIModelInfo[]>('/ai/models'),
  defaultModel: () => request<{ model: AIModelInfo | null }>('/ai/models/default'),
  setDefaultModel: (providerCode: string, name: string) =>
    request<{ providerCode: string; name: string; isDefault: boolean }>('/ai/models/default', {
      method: 'POST',
      body: JSON.stringify({ providerCode, name }),
    }),
  setModelEnabled: (providerCode: string, name: string, enabled: boolean) =>
    request<unknown>('/ai/models/enabled', {
      method: 'POST',
      body: JSON.stringify({ providerCode, name, enabled }),
    }),
  modelHealth: (providerCode: string, name: string) =>
    request<AIProviderHealth & { providerCode: string; modelName: string }>(`/ai/models/${providerCode}/${name}/health`),
  showModel: (providerCode: string, name: string) =>
    request<Record<string, unknown>>(`/ai/models/${providerCode}/${name}/show`),
  deleteModel: (providerCode: string, name: string) =>
    request<{ deleted: boolean }>(`/ai/models/${providerCode}/${name}`, { method: 'DELETE' }),

  routeDecision: (prompt: string, modelRef?: string) => {
    const qs = new URLSearchParams();
    qs.set('prompt', prompt);
    if (modelRef) qs.set('modelRef', modelRef);
    return request<AIRouterDecision>(`/ai/router/decision?${qs.toString()}`);
  },

  health: () => request<{ providers: Array<AIProviderHealth & { code: string }>; models: unknown[] }>('/ai/health'),
};

export async function pullModelStream(
  providerCode: string,
  name: string,
  onProgress: (progress: AIPullProgress) => void,
): Promise<void> {
  const { accessToken } = await import('../store/authStore').then((m) => m.useAuthStore.getState());
  const response = await fetch(`/api/v1/ai/models/${providerCode}/${name}/pull`, {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok || !response.body) {
    throw new Error(`pull failed: HTTP ${response.status}`);
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
        onProgress(JSON.parse(line.slice(5).trim()) as AIPullProgress);
      } catch {
        // ignore
      }
    }
  }
}
