export type AgentStatus = 'draft' | 'active' | 'disabled';

export interface AgentProfileView {
  id: number;
  code: string;
  name: string;
  description: string | null;
  avatar: string | null;
  systemPrompt: string;
  status: string;
  enabled: boolean;
  version: string;
  defaultModel: string | null;
  defaultKnowledgeScope: string | null;
  roleAccess: string | null;
  sortOrder: number;
  builtin: boolean;
  skills: Array<{ code: string; name: string; reserved: boolean; enabled: boolean }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentChatResult {
  agentCode: string;
  agentName: string;
  answer: string;
  skillUsed: string;
  conversationId?: number;
  citations?: unknown[];
  relatedDocuments?: unknown[];
  metrics?: Record<string, unknown>;
  latencyMs: number;
}
