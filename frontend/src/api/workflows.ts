import { request } from './client';

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  config?: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  when?: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowDefinition {
  id: number;
  code: string;
  name: string;
  description: string | null;
  categoryCode: string;
  categoryName: string;
  version: string;
  enabled: boolean;
  builtin: boolean;
  template: boolean;
  status: string;
  graph: WorkflowGraph;
  variables: unknown;
  roleAccess: string | null;
  timeoutMs: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: number;
  workflowCode: string;
  workflowName: string;
  userId: number;
  status: string;
  mode: string;
  trigger: string;
  input: unknown;
  output: unknown;
  variables: unknown;
  error: string | null;
  latencyMs: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  nodeRuns?: Array<{
    id: number;
    nodeId: string;
    nodeType: string;
    status: string;
    error: string | null;
    latencyMs: number;
  }>;
}

export interface WorkflowHealth {
  workflows: { total: number; enabled: number; templates: number };
  schedules: { enabled: number };
  runs: { total: number; success: number; errors24h: number };
  architecture: string;
  ok: boolean;
}

export interface WorkflowCategory {
  id: number;
  code: string;
  name: string;
  description: string | null;
  workflowCount?: number;
}

export const workflowsApi = {
  health: () => request<WorkflowHealth>('/workflows/health'),
  categories: () => request<WorkflowCategory[]>('/workflows/categories'),
  templates: () => request<WorkflowDefinition[]>('/workflows/templates'),
  list: (template?: boolean) =>
    request<WorkflowDefinition[]>(
      `/workflows${template === undefined ? '' : `?template=${template}`}`,
    ),
  get: (code: string) => request<WorkflowDefinition>(`/workflows/${code}`),
  update: (code: string, body: Partial<WorkflowDefinition> & { graph?: WorkflowGraph }) =>
    request<WorkflowDefinition>(`/workflows/${code}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  enable: (code: string) =>
    request<WorkflowDefinition>(`/workflows/${code}/enable`, { method: 'POST' }),
  disable: (code: string) =>
    request<WorkflowDefinition>(`/workflows/${code}/disable`, { method: 'POST' }),
  copy: (code: string, newCode: string, newName?: string) =>
    request<WorkflowDefinition>(`/workflows/${code}/copy`, {
      method: 'POST',
      body: JSON.stringify({ newCode, newName }),
    }),
  export: (code: string) => request<{ format: string; definition: WorkflowDefinition }>(`/workflows/${code}/export`),
  execute: (body: {
    code: string;
    input?: Record<string, unknown>;
    mode?: 'sync' | 'async' | 'queue';
  }) =>
    request<WorkflowRun>('/workflows/execute', {
      method: 'POST',
      body: JSON.stringify(body),
      timeoutMs: 180000,
    }),
  getRun: (id: number) => request<WorkflowRun>(`/workflows/runs/${id}`),
  history: (page = 1, pageSize = 30) =>
    request<{ items: Array<WorkflowRun & { workflow: { code: string; name: string } }>; total: number }>(
      `/workflows/history?page=${page}&pageSize=${pageSize}`,
    ),
  logs: (page = 1, pageSize = 30) =>
    request<{
      items: Array<{
        id: number;
        action: string;
        detail: string | null;
        createdAt: string;
        workflow: { code: string; name: string };
      }>;
      total: number;
    }>(`/workflows/logs?page=${page}&pageSize=${pageSize}`),
  scheduler: () =>
    request<
      Array<{
        id: number;
        name: string;
        enabled: boolean;
        kind: string;
        cronExpr: string | null;
        intervalSec: number | null;
        nextRunAt: string | null;
        lastRunAt: string | null;
        workflow: { code: string; name: string };
      }>
    >('/workflows/scheduler'),
  createSchedule: (body: {
    workflowCode: string;
    name: string;
    kind: string;
    cronExpr?: string;
    intervalSec?: number;
  }) =>
    request('/workflows/scheduler', { method: 'POST', body: JSON.stringify(body) }),
};
