# ZRH AI Gateway 架构设计（Stage 3.5）

> 阶段：Stage 3.5（仅设计，禁止开发）  
> 目标：为企业级长期演进建立统一模型接入层，禁止直接绑定 Ollama。

---

## 1. 总体目标

- **统一接入**：所有模型（Ollama / vLLM / SGLang / OpenAI / Claude / Gemini / Kimi）通过同一 Gateway 接入。
- **可替换**：业务代码不感知底层 Provider，仅依赖 Gateway 抽象接口。
- **可扩展**：新增模型或 Provider 只需实现 `AIProvider` 接口并注册到 Registry。
- **可观测**：统一日志、指标、熔断、限流、审计。
- **安全**：统一鉴权、脱敏、Prompt Injection 拦截、敏感词过滤。

---

## 2. 核心组件

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Web/Mobile)                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP / SSE
┌───────────────────────────▼─────────────────────────────────────┐
│                      ZRH AI Gateway                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Auth       │  │  Rate Limit │  │  Audit Log  │            │
│  │  Middleware │  │  Middleware │  │  Middleware │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Model Router                         │  │
│  │  (Rule / Cost / Latency / Capability / Load Balance)    │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                   Provider Registry                     │  │
│  │   OllamaProvider  OpenAIProvider  ClaudeProvider  ...   │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ internal protocol
┌───────────────────────────▼─────────────────────────────────────┐
│              Model Instances (Ollama / vLLM / etc.)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. AI Gateway 职责

### 3.1 入口统一
- 所有对话请求统一走 `/api/v1/gateway/chat`（SSE）。
- 统一请求/响应协议，与底层 Provider 解耦。
- 支持 `stream: true / false`。

### 3.2 中间件链
- **鉴权**：复用现有 JWT + RBAC。
- **限流**：按用户 / 模型 / Provider 限流（Token Bucket）。
- **审计**：记录请求元数据（用户、模型、Token、耗时），不记录消息内容。
- **熔断**：Provider 连续失败时自动降级或切换。
- **Prompt 安全检查**：Prompt Injection、敏感信息、超长输入拦截。

### 3.3 错误统一
- 所有 Provider 错误统一包装为 `{ code, message, retryable }`。
- 客户端无需处理不同 Provider 的错误格式。

---

## 4. Provider 抽象层

### 4.1 接口定义

```ts
interface AIProvider {
  readonly name: string;
  readonly capabilities: ModelCapability[];

  health(): Promise<ProviderHealth>;
  listModels(): Promise<ModelInfo[]>;

  generate(req: GenerateRequest): Promise<GenerateResponse>;
  stream(req: GenerateRequest, onEvent: StreamEventHandler): Promise<void>;
  stop(sessionId: string): Promise<boolean>;
}

interface GenerateRequest {
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  parameters: GenerationParameters;
  sessionId: string;
}

interface GenerateResponse {
  content: string;
  usage: TokenUsage;
  model: string;
  durationMs: number;
}
```

### 4.2 初始 Provider 实现

- `OllamaProvider`：本地 / 远程 Ollama，流式为 NDJSON。
- `OpenAIProvider`：OpenAI 兼容接口（含 Azure、Kimi、DeepSeek API）。
- `vLLMProvider`：OpenAI 兼容协议，支持高并发。
- `SGLangProvider`：OpenAI 兼容协议。
- `ClaudeProvider`：Anthropic Messages API。
- `GeminiProvider`：Google Gemini API。

### 4.3 Provider Registry

```ts
class ProviderRegistry {
  register(provider: AIProvider): void;
  get(name: string): AIProvider;
  list(): AIProvider[];
  healthAll(): Promise<ProviderHealth[]>;
}
```

配置示例：

```yaml
providers:
  - name: ollama-local
    type: ollama
    baseUrl: http://host.docker.internal:11434
    priority: 100
    models:
      - qwen3:8b
      - deepseek-r1:8b
      - deepseek-coder:latest
  - name: openai-proxy
    type: openai
    baseUrl: https://api.openai.com/v1
    apiKey: ${OPENAI_API_KEY}
    models:
      - gpt-4o
```

---

## 5. Model Registry

### 5.1 模型元数据

```ts
interface ModelInfo {
  id: string;                 // 全局唯一，如 "qwen3:8b"
  provider: string;           // Provider 名称
  displayName: string;
  capabilities: ModelCapability[]; // chat, code, reasoning, vision, tool
  contextWindow: number;
  maxOutputTokens: number;
  pricing?: TokenPricing;
  enabled: boolean;
  isDefault: boolean;
}
```

### 5.2 与现有 ModelConfig 表的映射

- 当前 `ModelConfig` 表保存本地 Ollama 的模型配置。
- 未来扩展为 `ModelRegistry` 服务，从 `Provider × ModelConfig` 联合计算可用模型清单。
- `ModelConfig` 增加 `providerId` 与 `externalId` 字段即可兼容。

---

## 6. Model Router

### 6.1 路由维度

| 维度 | 示例 |
|------|------|
| 任务类型 | 代码 → DeepSeek-Coder；推理 → DeepSeek-R1；中文 → Qwen；英文 → Llama |
| 成本 | 优先使用本地免费模型，本地不可用时 fallback 到云端 |
| 延迟 | 优先使用已加载到 VRAM 的模型 |
| 容量 | 根据当前并发与队列长度选择负载低的 Provider |
| 用户偏好 | 用户可设置默认模型或禁用某些模型 |
| 能力 | 需要 tool calling 时只选支持 tools 的模型 |

### 6.2 路由策略

```ts
interface RouterStrategy {
  select(req: RoutingRequest, candidates: ModelInfo[]): ModelInfo;
}

class CapabilityRouter implements RouterStrategy {
  select(req, candidates) {
    if (req.intent === 'code') return candidates.find(m => m.capabilities.includes('code'));
    if (req.intent === 'reasoning') return candidates.find(m => m.capabilities.includes('reasoning'));
    // fallback to default
  }
}
```

### 6.3 与现有模型切换的关系

- 当前：用户在 ChatSidebar 手动选择模型，写入 `Conversation.model`。
- 未来：保留手动选择，同时增加 "自动" 选项，由 Router 决定。
- Router 输出写入 `Message.model`，保留历史轨迹。

---

## 7. Prompt Manager

### 7.1 Prompt 层级

| 层级 | 作用 | 当前对应 |
|------|------|----------|
| System Prompt | 全局角色设定 | `PromptTemplate`（system 角色） |
| Conversation Prompt | 会话级系统提示 | `Conversation.systemPrompt` |
| User Prompt | 用户单次输入 | `Message.content`（role=user） |
| Assistant Prompt | 模型输出 | `Message.content`（role=assistant） |
| Memory Prompt | 长期记忆注入 | 未来 RAG / Memory 模块 |
| Tool Prompt | Tool Calling 描述 | 未来 Plugin / Agent |
| Agent Prompt | Agent 任务编排 | 未来 Agent |
| Template Prompt | 可复用模板 | `PromptTemplate` |

### 7.2 Prompt Manager 职责

- 模板渲染（支持变量替换）。
- 模板版本管理。
- Prompt 组合：System + Conversation + Memory + User。
- Prompt 长度控制：在 `contextLength` 限制内裁剪历史。
- Prompt 审计与敏感信息检测。

---

## 8. Session Manager

### 8.1 职责

- 管理进行中的生成会话（`sessionId`）。
- 维护 `AbortController`，支持 `stop()`。
- 记录会话级元数据：模型、Provider、开始时间、Token 消耗。
- 会话与用户绑定，禁止跨用户访问。

### 8.2 与现有 `active` Map 的关系

- 当前 `ChatService.active` 用 `${userId}:${conversationId}` 做 key。
- 未来演进为 `SessionManager`，key 改为 `sessionId`，支持一个 Conversation 内多个并行生成（如多模型同时回答）。

---

## 9. Streaming Manager

### 9.1 职责

- 统一 SSE 输出协议（与当前一致：`meta` / `delta` / `done` / `error`）。
- 适配不同 Provider 的流式格式：
  - Ollama：NDJSON
  - OpenAI：SSE `data: {...}`
  - Claude：SSE
- 流式错误处理与重连。
- 流式指标采集：首 Token 延迟、Token 速度、断流检测。

---

## 10. 未来架构预留

### 10.1 RAG（检索增强生成）

```
User Query → Query Rewriter → Retriever (Vector DB) → Reranker →
Context Builder → Prompt Manager → Gateway → Model
```

- 预留 `retrievalContext` 字段。
- 向量数据库建议：pgvector（与现有 PostgreSQL 同实例）或独立 Milvus。
- 文档 Embedding 服务独立部署。

### 10.2 MCP（Model Context Protocol）

- 预留 MCP Server 接入点。
- Gateway 在调用模型前可将 MCP 资源注入 Prompt。
- 支持本地文件系统、数据库、API 等 MCP Server。

### 10.3 Agent

```
Planner → Tool Selector → Executor → Observer → Gateway
```

- Agent 通过 Gateway 调用模型。
- Tool Calling 结果回注到 Session。
- 支持 ReAct / Plan-and-Execute 等模式。

### 10.4 Plugin / Tool Calling

- 统一 Tool Schema 注册。
- Provider 能力声明中包含 `tool`。
- Gateway 负责 Tool 调用循环：模型决定调用 → 执行 Tool → 结果回传 → 模型生成最终回复。

---

## 11. 数据流示例

```
1. 用户发送消息
2. Gateway 鉴权 + 限流
3. Prompt Manager 组合 Prompt
4. Model Router 选择模型/Provider
5. Provider Registry 调用具体 Provider
6. Streaming Manager 统一输出 SSE
7. Session Manager 记录会话与停止句柄
8. Audit Middleware 记录元数据
9. 消息持久化到 PostgreSQL
```

---

## 12. 阶段 4 实施建议

1. 创建 `gateway` 模块，先接入 `OllamaProvider` 保持现有功能不变。
2. 将 `ChatService.stream` 中的 Ollama 调用迁移到 `OllamaProvider`。
3. 抽象 `AIProvider` 接口。
4. 扩展 `ModelConfig` 表支持 `providerId` / `externalId`。
5. 实现 `ProviderRegistry` 与 `ModelRegistry`。
6. 保留手动模型切换，增加 "自动路由" 选项。
7. 后续逐步接入 OpenAI / Claude / vLLM 等 Provider。

---

## 13. 风险与约束

- **网络依赖**：云端 Provider 需要外网访问与 API Key 管理。
- **成本**：自动路由到云端模型可能产生费用，需要成本上限控制。
- **延迟**：云端模型延迟高于本地 Ollama，需要熔断与降级策略。
- **一致性**：不同 Provider 的 Token 计数、流式格式、错误码需要统一。
