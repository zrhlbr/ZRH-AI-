export interface HealthReport {
  service: string;
  version: string;
  status: 'ok' | 'degraded';
  timestamp: string;
  database: 'online' | 'offline';
  redis: 'online' | 'offline';
  ollama: 'online' | 'offline';
}

export interface OllamaStatus {
  status: 'online' | 'offline';
  baseUrl: string;
  latencyMs?: number;
  error?: string;
}

export interface OllamaModel {
  name: string;
  model: string;
  size: number;
  modified_at: string;
  digest: string;
}

export interface OllamaModelsResponse {
  status: 'online' | 'offline';
  models: OllamaModel[];
  error?: string;
}

// 前端始终通过相对路径 /api 访问后端：
// 开发环境由 Vite 代理到 4010，生产环境由 nginx 代理到 zrh-ai-api。
async function getJson<T>(path: string, timeoutMs = 8000): Promise<T> {
  const response = await fetch(path, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export const api = {
  health: () => getJson<HealthReport>('/api/health'),
  ollamaHealth: () => getJson<OllamaStatus>('/api/ollama/health'),
  ollamaModels: () => getJson<OllamaModelsResponse>('/api/ollama/models'),
};
