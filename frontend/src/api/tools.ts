import { request } from './client';

export interface ToolCategory {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  toolCount?: number;
}

export interface ToolDefinition {
  id: number;
  code: string;
  name: string;
  description: string | null;
  categoryCode: string;
  categoryName: string;
  version: string;
  enabled: boolean;
  builtin: boolean;
  inputSchema: unknown;
  timeoutMs: number;
  maxRetries: number;
  roleAccess: string | null;
  executorCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolExecuteResult {
  toolCode: string;
  status: 'success' | 'error' | 'timeout';
  mode: string;
  output: unknown;
  error?: string;
  latencyMs: number;
  logId?: number;
}

export interface ToolHealth {
  tools: { total: number; enabled: number; disabled: number; builtin: number };
  categories: { total: number };
  logs: { total: number; success: number; errors24h: number };
  ok: boolean;
}

export interface ToolRunLog {
  id: number;
  status: string;
  latencyMs: number;
  error: string | null;
  createdAt: string;
  tool: { code: string; name: string };
}

export const toolsApi = {
  health: () => request<ToolHealth>('/tools/health'),
  categories: () => request<ToolCategory[]>('/tools/categories'),
  permissions: () =>
    request<Array<{ code: string; name: string; enabled: boolean; roleAccess: string | null; requiredPermission: string }>>(
      '/tools/permissions',
    ),
  list: (enabled?: boolean) =>
    request<ToolDefinition[]>(`/tools${enabled === undefined ? '' : `?enabled=${enabled}`}`),
  get: (code: string) => request<ToolDefinition>(`/tools/${code}`),
  route: (task: string, agentCode?: string) => {
    const q = new URLSearchParams({ task });
    if (agentCode) q.set('agentCode', agentCode);
    return request<{
      toolCode: string;
      args: Record<string, unknown>;
      reason: string;
      candidates: Array<{ code: string; name: string; categoryCode: string }>;
    }>(`/tools/route?${q.toString()}`);
  },
  execute: (body: {
    toolCode: string;
    args?: Record<string, unknown>;
    mode?: 'sync' | 'async' | 'streaming';
    agentCode?: string;
  }) =>
    request<ToolExecuteResult>('/tools/execute', {
      method: 'POST',
      body: JSON.stringify(body),
      timeoutMs: 60000,
    }),
  call: (body: {
    message: string;
    agentCode?: string;
    toolCode?: string;
    args?: Record<string, unknown>;
  }) =>
    request<{
      plan: { toolCode: string; args: Record<string, unknown>; reason: string };
      result: ToolExecuteResult;
      llmAssisted: boolean;
    }>('/tools/call', { method: 'POST', body: JSON.stringify(body), timeoutMs: 120000 }),
  enable: (code: string) => request<ToolDefinition>(`/tools/${code}/enable`, { method: 'POST' }),
  disable: (code: string) => request<ToolDefinition>(`/tools/${code}/disable`, { method: 'POST' }),
  logs: (page = 1, pageSize = 30) =>
    request<{ items: ToolRunLog[]; total: number }>(`/tools/logs?page=${page}&pageSize=${pageSize}`),
};
