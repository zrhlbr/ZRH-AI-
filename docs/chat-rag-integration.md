# Chat ↔ Enterprise RAG 集成

## 目标

Chat 默认经 Enterprise RAG 编排（Rewrite → Retrieve → Rerank），命中则注入知识上下文并带 Citation 流式回答；未命中透明回退到原 Gateway 流式对话。LLM 生成始终经 AI Gateway。

## 开关

| 环境变量 | 默认 | 说明 |
|---------|------|------|
| `CHAT_RAG_ENABLED` | `true` | `false` 时与旧 Chat 行为一致 |
| `CHAT_RAG_MIN_SCORE` | `0.28` | rerank 后 top1 分数阈值 |

## 链路

1. `ChatService.stream`（`send` / `regenerate`）调用 `RagEngineService.prepare()`
2. **Hit**：`PromptBuilderService.build` + `gateway.stream`；SSE 发 `rag` 事件与 citations；消息落库 `ragHit` / `citations` / `rewrittenQuery`
3. **Miss**：SSE `{ type:'rag', hit:false }`，走原 systemPrompt + history → `gateway.stream`
4. `continue` 不重检索，仅续写

会话只写入 Chat 的 `conversations` / `messages`，不调用 RAG `persistTurn`。

## 验收

- Chat 问「ZRH TECH 创始人是谁」→ 命中并展示来源
- 泛问（如天气）→ 未命中、无来源条、仍正常回答
- `/rag/ask` 与 Agent `rag.ask` 行为不变
- `CHAT_RAG_ENABLED=false` 可回滚

## 范围外

不改 Gateway / Agent / Workflow / MCP / Business Hub 内部逻辑；`/rag/*` API 保留。
