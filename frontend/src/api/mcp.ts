import { request } from './client';

export interface McpServer {
  id: number;
  code: string;
  name: string;
  description: string | null;
  transport: string;
  endpoint: string | null;
  enabled: boolean;
  status: string;
  version: string;
  builtin: boolean;
  reserved: boolean;
  roleAccess: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface McpSession {
  id: number;
  serverCode: string;
  serverName: string;
  userId: number;
  status: string;
  metadata: unknown;
  startedAt: string;
  endedAt: string | null;
}

export interface McpHealth {
  servers: { total: number; enabled: number; reserved: number; online: number };
  sessions: { active: number };
  logs: { total: number; errors24h: number };
  gateway: string;
  ok: boolean;
}

export interface McpRunLog {
  id: number;
  action: string;
  status: string;
  detail: string | null;
  latencyMs: number;
  createdAt: string;
  server: { code: string; name: string };
}

export const mcpApi = {
  health: () => request<McpHealth>('/mcp/health'),
  servers: (enabled?: boolean) =>
    request<McpServer[]>(`/mcp/servers${enabled === undefined ? '' : `?enabled=${enabled}`}`),
  get: (code: string) => request<McpServer>(`/mcp/servers/${code}`),
  enable: (code: string) => request<McpServer>(`/mcp/servers/${code}/enable`, { method: 'POST' }),
  disable: (code: string) => request<McpServer>(`/mcp/servers/${code}/disable`, { method: 'POST' }),
  connect: (serverCode: string) =>
    request<McpSession>('/mcp/connect', {
      method: 'POST',
      body: JSON.stringify({ serverCode }),
    }),
  disconnect: (body: { sessionId?: number; serverCode?: string }) =>
    request<{ disconnected: number }>('/mcp/disconnect', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  sessions: () => request<McpSession[]>('/mcp/sessions'),
  logs: (page = 1, pageSize = 30) =>
    request<{ items: McpRunLog[]; total: number }>(`/mcp/logs?page=${page}&pageSize=${pageSize}`),
};
