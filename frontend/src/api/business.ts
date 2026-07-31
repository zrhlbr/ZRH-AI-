import { request } from './client';

export interface BusinessSystem {
  id: number;
  code: string;
  name: string;
  description: string | null;
  kind: string;
  enabled: boolean;
  status: string;
  version: string;
  readOnlyDefault: boolean;
  writeRequiresApproval: boolean;
  companyCode: string | null;
  connectors: Array<{
    code: string;
    name: string;
    transport: string;
    enabled: boolean;
    status: string;
    healthStatus: string;
  }>;
  workflows: Array<{
    actionCode: string;
    workflowCode: string;
    name: string;
    isDefault: boolean;
    requiresApproval: boolean;
    readOnly: boolean;
  }>;
}

export interface BusinessHealth {
  systems: { total: number; online: number; kinds: string[] };
  connectors: { enabled: number; healthy: number };
  audits24h: number;
  recent: Array<{
    id: number;
    action: string;
    status: string;
    createdAt: string;
    system: { code: string; name: string };
  }>;
  architecture: string;
  ok: boolean;
}

export interface BusinessInvokeResult {
  systemCode: string;
  action: string;
  workflowCode: string;
  workflowRunId: number;
  workflowStatus: string;
  connector: unknown;
  readOnly: boolean;
  requiresApproval: boolean;
  architecture: string;
}

export const businessApi = {
  health: () => request<BusinessHealth>('/business/health'),
  systems: () => request<BusinessSystem[]>('/business/systems'),
  get: (code: string) => request<BusinessSystem>(`/business/systems/${code}`),
  companies: () => request<Array<{ id: number; code: string; name: string; enabled: boolean }>>('/business/companies'),
  connectors: (systemCode?: string) =>
    request<unknown[]>(`/business/connectors${systemCode ? `?systemCode=${systemCode}` : ''}`),
  workflows: (systemCode?: string) =>
    request<unknown[]>(`/business/workflows${systemCode ? `?systemCode=${systemCode}` : ''}`),
  invoke: (body: { systemCode: string; action: string; input?: Record<string, unknown> }) =>
    request<BusinessInvokeResult>('/business/invoke', {
      method: 'POST',
      body: JSON.stringify(body),
      timeoutMs: 180000,
    }),
  logs: (page = 1, pageSize = 30) =>
    request<{
      items: Array<{
        id: number;
        action: string;
        status: string;
        workflowCode: string | null;
        detail: string | null;
        createdAt: string;
        system: { code: string; name: string };
      }>;
      total: number;
    }>(`/business/logs?page=${page}&pageSize=${pageSize}`),
};
