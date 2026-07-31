import { request } from './client';

export interface AgentSkill {
  id?: number;
  code: string;
  name: string;
  description?: string | null;
  category?: string;
  enabled: boolean;
  reserved: boolean;
}

export interface AgentProfile {
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
  skills: AgentSkill[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentChatResult {
  agentCode: string;
  agentName: string;
  answer: string;
  skillUsed: string;
  conversationId?: number;
  citations?: Array<{ index: number; title: string; snippet: string; score: number }>;
  relatedDocuments?: Array<{ id: number; title: string; filename: string; score: number }>;
  latencyMs: number;
}

export interface AgentHealth {
  agents: { total: number; active: number; disabled: number };
  skills: { total: number; enabled: number; reserved: number };
  logs: { total: number; errors24h: number };
  ok: boolean;
}

export interface AgentMemoryItem {
  id: number;
  kind: string;
  key: string | null;
  content: string;
  conversationId: number | null;
  createdAt: string;
}

export interface AgentRunLog {
  id: number;
  skillCode: string | null;
  inputSummary: string | null;
  status: string;
  latencyMs: number;
  error: string | null;
  createdAt: string;
  agent: { code: string; name: string };
}

export const agentsApi = {
  health: () => request<AgentHealth>('/agents/health'),
  list: (enabled?: boolean) =>
    request<AgentProfile[]>(`/agents${enabled === undefined ? '' : `?enabled=${enabled}`}`),
  get: (code: string) => request<AgentProfile>(`/agents/${code}`),
  skills: () => request<AgentSkill[]>('/agents/skills'),
  route: (q: string) =>
    request<{ agentCode: string; agentName: string; reason: string }>(
      `/agents/route?q=${encodeURIComponent(q)}`,
    ),
  enable: (code: string) => request<AgentProfile>(`/agents/${code}/enable`, { method: 'POST' }),
  disable: (code: string) => request<AgentProfile>(`/agents/${code}/disable`, { method: 'POST' }),
  update: (code: string, data: Partial<AgentProfile> & { skillCodes?: string[] }) =>
    request<AgentProfile>(`/agents/${code}`, { method: 'PATCH', body: JSON.stringify(data) }),
  chat: (data: { message: string; agentCode?: string; conversationId?: number; modelRef?: string }) =>
    request<AgentChatResult>('/agents/chat', {
      method: 'POST',
      body: JSON.stringify(data),
      timeoutMs: 180000,
    }),
  memories: (code: string) => request<AgentMemoryItem[]>(`/agents/${code}/memory`),
  createMemory: (code: string, content: string, kind = 'note') =>
    request<AgentMemoryItem>(`/agents/${code}/memory`, {
      method: 'POST',
      body: JSON.stringify({ content, kind }),
    }),
  logs: (page = 1, pageSize = 20, agentCode?: string) =>
    request<{ page: number; pageSize: number; total: number; items: AgentRunLog[] }>(
      `/agents/logs?page=${page}&pageSize=${pageSize}${agentCode ? `&agentCode=${agentCode}` : ''}`,
    ),
};
