import { useAuthStore } from '../store/authStore';

/**
 * 统一 API 客户端：
 * - 只走相对路径 /api/v1（开发 Vite 代理 / 生产 nginx 代理）
 * - 自动解包 { code, message, data, timestamp }
 * - 401 时自动用 Refresh Token 续期一次并重试
 */

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const API_BASE = '/api/v1';

export type ApiRequestInit = RequestInit & { timeoutMs?: number };

async function rawRequest<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const { timeoutMs = 10000, signal, ...rest } = init;
  const headers: Record<string, string> = {
    ...(rest.headers as Record<string, string> | undefined),
  };
  // FormData / URLSearchParams 需要浏览器自行设置 Content-Type（含 boundary）
  if (!(rest.body instanceof FormData) && !(rest.body instanceof URLSearchParams)) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    signal: signal ?? AbortSignal.timeout(timeoutMs),
  });

  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !envelope) {
    throw new ApiError(response.status, envelope?.message ?? `HTTP ${response.status}`);
  }
  return envelope.data;
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) return false;
  try {
    const data = await rawRequest<{
      accessToken: string;
      refreshToken: string;
    }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clear();
    return false;
  }
}

export async function request<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, init);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && !path.startsWith('/auth/')) {
      refreshing ??= tryRefresh().finally(() => {
        refreshing = null;
      });
      if (await refreshing) {
        return rawRequest<T>(path, init);
      }
    }
    throw error;
  }
}

// ---------- 类型与接口 ----------

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

export interface LoginResult {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface SystemMetric {
  available: boolean;
  reason?: string;
  [key: string]: unknown;
}

export const api = {
  // 公开
  health: () => request<HealthReport>('/health'),
  login: (username: string, password: string) =>
    request<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: (refreshToken: string) =>
    request<{ revoked: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  // 鉴权
  profile: () =>
    request<{
      id: number;
      username: string;
      displayName: string;
      role: string;
      roleName: string;
      permissions: string[];
    }>('/auth/profile'),
  ollamaHealth: () => request<OllamaStatus>('/ollama/health'),
  ollamaModels: () => request<{ status: 'online' | 'offline'; models: OllamaModel[]; error?: string }>('/ollama/models'),
  systemCpu: () => request<SystemMetric>('/system/cpu'),
  systemMemory: () => request<SystemMetric>('/system/memory'),
  systemGpu: () => request<SystemMetric>('/system/gpu'),
  systemNetwork: () => request<SystemMetric>('/system/network'),
  systemStorage: () => request<SystemMetric>('/system/storage'),
  systemDocker: () => request<SystemMetric>('/system/docker'),
};
