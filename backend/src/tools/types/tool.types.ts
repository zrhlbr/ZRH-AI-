export interface ToolCategoryView {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  toolCount?: number;
}

export interface ToolDefinitionView {
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
  outputSchema: unknown;
  timeoutMs: number;
  maxRetries: number;
  roleAccess: string | null;
  executorCode: string;
  config: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export type ToolRunMode = 'sync' | 'async' | 'streaming';

export interface ToolExecuteResult {
  toolCode: string;
  status: 'success' | 'error' | 'timeout';
  mode: ToolRunMode;
  output: unknown;
  error?: string;
  latencyMs: number;
  logId?: number;
}

export interface ToolCallPlan {
  toolCode: string;
  args: Record<string, unknown>;
  reason: string;
}
