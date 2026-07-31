# ZRH AI 模型抽象层与路由设计（Stage 3.5）

> 阶段：Stage 3.5（仅设计，禁止开发）  
> 目标：定义统一模型接口与路由策略，使业务代码与底层模型完全解耦。

---

## 1. 设计原则

- **接口统一**：所有模型实现同一 `AIProvider` 接口。
- **职责分离**：Provider 负责协议转换，Router 负责模型选择，Gateway 负责编排。
- **最小侵入**：当前 Ollama 实现未来只需包装为 `OllamaProvider`，现有业务接口不变。
- **能力驱动**：模型按能力（chat / code / reasoning / vision / tool）注册，Router 按能力匹配。

---

## 2. AIProvider 统一接口

```ts
// 消息结构（与现有 ChatMessage 保持一致）
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

// 生成参数（与现有 ChatParams 对齐）
interface GenerationParameters {
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  contextLength: number;
  maxTokens: number;
  seed?: number | null;
}

// Token 消耗
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// 模型信息
interface ModelInfo {
  id: string;
  provider: string;
  displayName: string;
  capabilities: ModelCapability[];
  contextWindow: number;
  maxOutputTokens: number;
  enabled: boolean;
  isDefault: boolean;
}

type ModelCapability =
  | 'chat'
  | 'code'
  | 'reasoning'
  | 'vision'
  | 'tool'
  | 'multilingual'
  | 'long-context';

// Provider 健康状态
interface ProviderHealth {
  provider: string;
  status: 'online' | 'degraded' | 'offline';
  latencyMs: number;
  message?: string;
}

// 统一 Provider 接口
interface AIProvider {
  readonly name: string;

  /** 探活 */
  health(): Promise<ProviderHealth>;

  /** 列出该 Provider 下所有可用模型 */
  listModels(): Promise<ModelInfo[]>;

  /** 非流式生成 */
  generate(req: GenerateRequest): Promise<GenerateResponse>;

  /** 流式生成 */
  stream(
    req: GenerateRequest,
    callbacks: {
      onMeta: (meta: StreamMeta) => void;
      onDelta: (delta: string) => void;
      onDone: (result: StreamDone) => void;
      onError: (error: ProviderError) => void;
    },
  ): Promise<void>;

  /** 停止指定会话的生成 */
  stop(sessionId: string): Promise<boolean>;
}

interface GenerateRequest {
  sessionId: string;
  model: string;                // Provider 内部模型 ID
  messages: ChatMessage[];
  parameters: GenerationParameters;
}

interface GenerateResponse {
  content: string;
  usage: TokenUsage;
  model: string;
  durationMs: number;
}

interface StreamMeta {
  sessionId: string;
  model: string;
}

interface StreamDone {
  usage: TokenUsage;
  durationMs: number;
  status: 'done' | 'stopped';
}

interface ProviderError {
  code: string;
  message: string;
  retryable: boolean;
}
```

---

## 3. Provider 实现示例

### 3.1 OllamaProvider

```ts
class OllamaProvider implements AIProvider {
  readonly name = 'ollama';

  constructor(private baseUrl: string) {}

  async health(): Promise<ProviderHealth> {
    const t0 = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      return { provider: this.name, status: res.ok ? 'online' : 'offline', latencyMs: Date.now() - t0 };
    } catch {
      return { provider: this.name, status: 'offline', latencyMs: Date.now() - t0 };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    const data = await res.json();
    return data.models.map((m: any) => ({
      id: m.name,
      provider: this.name,
      displayName: m.name,
      capabilities: inferCapabilities(m.name),
      contextWindow: m.details?.context_length ?? 4096,
      maxOutputTokens: 8192,
      enabled: true,
      isDefault: false,
    }));
  }

  async stream(req, callbacks) {
    const abort = new AbortController();
    activeControllers.set(req.sessionId, abort);

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abort.signal,
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        stream: true,
        options: convertParameters(req.parameters),
      }),
    });

    callbacks.onMeta({ sessionId: req.sessionId, model: req.model });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const chunk = JSON.parse(line);
        if (chunk.message?.content) callbacks.onDelta(chunk.message.content);
        if (chunk.done) callbacks.onDone({ usage: convertUsage(chunk), durationMs: chunk.total_duration / 1e6, status: 'done' });
      }
    }
  }

  async stop(sessionId: string): Promise<boolean> {
    const ctrl = activeControllers.get(sessionId);
    if (!ctrl) return false;
    ctrl.abort();
    activeControllers.delete(sessionId);
    return true;
  }
}
```

### 3.2 OpenAIProvider

```ts
class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  constructor(private baseUrl: string, private apiKey: string) {}

  async stream(req, callbacks) {
    const abort = new AbortController();
    activeControllers.set(req.sessionId, abort);

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: abort.signal,
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        stream: true,
        temperature: req.parameters.temperature,
        max_tokens: req.parameters.maxTokens,
        top_p: req.parameters.topP,
      }),
    });

    callbacks.onMeta({ sessionId: req.sessionId, model: req.model });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        const line = frame.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        const chunk = JSON.parse(data);
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (delta) callbacks.onDelta(delta);
      }
    }
  }
}
```

### 3.3 其他 Provider 映射

| Provider | 协议 | 备注 |
|----------|------|------|
| vLLM | OpenAI 兼容 | 与 OpenAIProvider 共用，baseUrl 不同 |
| SGLang | OpenAI 兼容 | 与 OpenAIProvider 共用 |
| Claude | Anthropic Messages | 需独立适配 |
| Gemini | Google Gemini | 需独立适配 |
| Kimi | OpenAI 兼容 | 与 OpenAIProvider 共用 |

---

## 4. Model Router 设计

### 4.1 路由输入

```ts
interface RoutingRequest {
  userId: number;
  conversationId?: number;
  intent?: 'chat' | 'code' | 'reasoning' | 'creative' | 'summary';
  preferredModel?: string;      // 用户手动指定
  requiredCapabilities?: ModelCapability[];
  languageHint?: 'zh' | 'en' | 'my' | 'auto';
  maxLatencyMs?: number;
  maxCost?: number;
}
```

### 4.2 路由输出

```ts
interface RoutingResult {
  modelId: string;      // 全局模型 ID，如 "qwen3:8b"
  providerName: string; // 实际 Provider，如 "ollama"
  internalModel: string;// Provider 内部模型名
  reason: string;       // 路由原因，用于可解释性
}
```

### 4.3 路由策略实现

```ts
interface RouterStrategy {
  select(req: RoutingRequest, candidates: ModelInfo[]): RoutingResult | null;
}

class CompositeRouter implements RouterStrategy {
  constructor(private strategies: RouterStrategy[]) {}

  select(req, candidates) {
    for (const s of this.strategies) {
      const result = s.select(req, candidates);
      if (result) return result;
    }
    return null;
  }
}

/** 1. 用户手动指定优先 */
class UserPreferenceRouter implements RouterStrategy {
  select(req, candidates) {
    if (!req.preferredModel) return null;
    const match = candidates.find(c => c.id === req.preferredModel && c.enabled);
    return match ? { modelId: match.id, providerName: match.provider, internalModel: match.id, reason: 'user-preference' } : null;
  }
}

/** 2. 按任务能力路由 */
class CapabilityRouter implements RouterStrategy {
  select(req, candidates) {
    if (req.intent === 'code') {
      return this.pick(candidates, 'code', 'deepseek-coder:latest');
    }
    if (req.intent === 'reasoning') {
      return this.pick(candidates, 'reasoning', 'deepseek-r1:8b');
    }
    if (req.languageHint === 'zh') {
      return this.pick(candidates, 'multilingual', 'qwen3:8b');
    }
    return null;
  }

  private pick(candidates, capability, fallbackId) {
    const match = candidates.find(c => c.capabilities.includes(capability) && c.enabled)
               || candidates.find(c => c.id === fallbackId && c.enabled);
    return match ? { modelId: match.id, providerName: match.provider, internalModel: match.id, reason: `capability:${capability}` } : null;
  }
}

/** 3. 默认模型兜底 */
class DefaultRouter implements RouterStrategy {
  select(req, candidates) {
    const def = candidates.find(c => c.isDefault && c.enabled) || candidates.find(c => c.enabled);
    if (!def) return null;
    return { modelId: def.id, providerName: def.provider, internalModel: def.id, reason: 'default' };
  }
}
```

### 4.4 路由规则示例

```yaml
routing:
  default: qwen3:8b
  rules:
    - name: code
      when: intent == 'code'
      model: deepseek-coder:latest
    - name: reasoning
      when: intent == 'reasoning'
      model: deepseek-r1:8b
    - name: chinese
      when: language == 'zh'
      model: qwen3:8b
    - name: english
      when: language == 'en'
      model: llama3.1:8b
```

---

## 5. Provider Registry

```ts
class ProviderRegistry {
  private providers = new Map<string, AIProvider>();

  register(provider: AIProvider) {
    this.providers.set(provider.name, provider);
  }

  get(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  list(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  async healthAll(): Promise<ProviderHealth[]> {
    return Promise.all(this.list().map(p => p.health()));
  }

  async listAllModels(): Promise<ModelInfo[]> {
    const lists = await Promise.all(this.list().map(p => p.listModels().catch(() => [])));
    return lists.flat();
  }
}
```

---

## 6. 与现有代码的迁移路径

1. 当前 `ChatService` 直接调用 `fetch(${OLLAMA_BASE_URL}/api/chat)`。
2. 阶段 4 第一步：创建 `OllamaProvider`，将这部分逻辑迁移进去。
3. `ChatService` 改为依赖 `ProviderRegistry` 与 `ModelRouter`。
4. 保持 `/api/v1/chat` 接口不变，内部通过 Gateway 调用。
5. `ModelConfig` 表增加字段：`providerId`, `externalId`, `capabilities`。

---

## 7. 阶段 4 建议接口变更

- 新增 `GET /api/v1/gateway/providers` — Provider 列表与健康。
- 新增 `GET /api/v1/gateway/models` — 统一模型清单（替代现有 `/chat/models`）。
- 新增 `POST /api/v1/gateway/chat` — 统一对话入口（可选，保持 `/chat` 兼容）。
- 现有 `/chat/models` 逐步 deprecate，改为调用 Gateway。
