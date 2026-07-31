export type WorkflowNodeType =
  | 'start'
  | 'end'
  | 'agent'
  | 'tool'
  | 'mcp'
  | 'condition'
  | 'loop'
  | 'delay'
  | 'switch'
  | 'merge'
  | 'approval'
  | 'webhook';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
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

export interface WorkflowDefinitionView {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowRunView {
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
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  nodeRuns?: WorkflowNodeRunView[];
}

export interface WorkflowNodeRunView {
  id: number;
  nodeId: string;
  nodeType: string;
  status: string;
  input: unknown;
  output: unknown;
  error: string | null;
  latencyMs: number;
  attempt: number;
  startedAt: Date | null;
  finishedAt: Date | null;
}
