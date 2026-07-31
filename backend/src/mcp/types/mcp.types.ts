export interface McpServerView {
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
  config: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface McpSessionView {
  id: number;
  serverCode: string;
  serverName: string;
  userId: number;
  status: string;
  metadata: unknown;
  startedAt: Date;
  endedAt: Date | null;
}
