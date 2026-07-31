/**
 * AI Gateway 通用类型定义
 * 所有 Provider 必须基于这些类型进行输入输出。
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIGenerationOptions {
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  contextLength?: number;
  maxTokens?: number;
  seed?: number | null;
  stop?: string[];
}

export interface AIStreamChunk {
  type: 'delta' | 'done' | 'error';
  content?: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  durationMs?: number | null;
  message?: string;
}

export interface AIUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  durationMs: number | null;
}

export interface AIModelDescriptor {
  name: string;
  displayName: string;
  providerCode: string;
  description?: string;
  sizeBytes?: number | null;
  digest?: string | null;
  status?: string;
  enabled?: boolean;
  isDefault?: boolean;
  contextLength?: number;
  capabilities?: string[];
}

export interface AIProviderHealth {
  status: 'online' | 'offline' | 'error';
  latencyMs?: number;
  error?: string;
  checkedAt: Date;
}

export interface AIPullProgress {
  status: 'pulling' | 'complete' | 'error';
  completed?: number;
  total?: number;
  digest?: string;
  error?: string;
}

export interface AIRouterDecision {
  providerCode: string;
  modelName: string;
  reason: string;
}
