# ZRH AI Prompt 架构设计（Stage 3.5）

> 阶段：Stage 3.5（仅设计，禁止开发）  
> 目标：建立分层、可复用、可审计的 Prompt 管理体系。

---

## 1. 设计目标

- **分层管理**：System / Conversation / User / Assistant / Memory / Tool / Agent / Template 各层职责清晰。
- **可复用**：Template Prompt 支持变量替换与版本管理。
- **可审计**：所有最终进入模型的 Prompt 可追溯、可记录哈希。
- **安全**：Prompt Injection 检测、敏感信息过滤、长度控制。
- **可扩展**：为未来 RAG、Agent、Tool Calling 预留注入点。

---

## 2. Prompt 层级

```
┌─────────────────────────────────────────┐
│ System Prompt                           │  ← 全局角色设定（所有用户/会话共享）
├─────────────────────────────────────────┤
│ Conversation Prompt                     │  ← 会话级系统提示（可覆盖全局）
├─────────────────────────────────────────┤
│ Memory Prompt                           │  ← RAG / 长期记忆注入（未来）
├─────────────────────────────────────────┤
│ Tool Prompt                             │  ← Tool / Plugin 描述（未来）
├─────────────────────────────────────────┤
│ User Prompt                             │  ← 用户当前输入
├─────────────────────────────────────────┤
│ Assistant Prompt (历史)                 │  ← 模型历史输出
└─────────────────────────────────────────┘
```

---

## 3. 各层详细说明

### 3.1 System Prompt

- **作用**：定义 AI 的全局身份、行为边界、输出格式。
- **范围**：整个系统或整个租户共享。
- **当前映射**：`PromptTemplate` 表中 `role = 'system'` 且 `isDefault = true` 的模板。
- **示例**：
  ```
  You are ZRH AI, a helpful assistant inside the ZRH ecosystem.
  Answer accurately and concisely. Use Markdown for structure.
  ```

### 3.2 Conversation Prompt

- **作用**：针对单个会话的额外系统提示。
- **范围**：仅当前 `Conversation`。
- **当前映射**：`Conversation.systemPrompt` 字段。
- **使用场景**：用户为某次聊天自定义角色，如 "你是一位法律顾问"。

### 3.3 User Prompt

- **作用**：用户的原始输入。
- **处理**：可直接送入模型，也可经过 Query Rewriting、敏感信息过滤。
- **当前映射**：`Message.content`（role=user）。

### 3.4 Assistant Prompt

- **作用**：模型历史输出，作为多轮对话上下文。
- **当前映射**：`Message.content`（role=assistant）。
- **注意**：长期对话需按 Token 预算裁剪，保留最近 N 条或摘要。

### 3.5 Memory Prompt

- **作用**：注入长期记忆或检索结果。
- **未来实现**：RAG 模块检索到的相关文档片段。
- **示例**：
  ```
  [Retrieved Context]
  1. 公司请假流程：...
  2. 报销政策：...
  ```

### 3.6 Tool Prompt

- **作用**：描述可用工具及其 Schema。
- **未来实现**：Tool Calling / Plugin 能力。
- **示例**：
  ```
  You have access to the following tools:
  - search_database(query: string)
  - send_email(to: string, subject: string, body: string)
  ```

### 3.7 Agent Prompt

- **作用**：Agent 任务规划、反思、执行指令。
- **未来实现**：Agent 编排层。
- **示例（ReAct）**：
  ```
  You can reason and act. Format:
  Thought: ...
  Action: ...
  Observation: ...
  ```

### 3.8 Template Prompt

- **作用**：可复用模板，支持变量替换。
- **当前映射**：`PromptTemplate` 表。
- **示例**：
  ```
  请将以下 {{source_lang }} 文本翻译为 {{target_lang}}：
  {{text}}
  ```

---

## 4. Prompt Manager 设计

```ts
class PromptManager {
  constructor(
    private templateRepo: PromptTemplateRepository,
    private safety: PromptSafetyService,
  ) {}

  /** 构建最终进入模型的消息列表 */
  async build(ctx: PromptContext): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];

    // 1. System Prompt
    const system = await this.resolveSystem(ctx);
    if (system) messages.push({ role: 'system', content: system });

    // 2. Memory / RAG
    const memory = await this.resolveMemory(ctx);
    if (memory) messages.push({ role: 'system', content: memory });

    // 3. Tool Description
    const tools = await this.resolveTools(ctx);
    if (tools) messages.push({ role: 'system', content: tools });

    // 4. Conversation history (truncated by context budget)
    const history = this.truncateHistory(ctx.history, ctx.budget);
    messages.push(...history);

    // 5. Current user input
    messages.push({ role: 'user', content: await this.safety.process(ctx.userInput) });

    return messages;
  }

  private async resolveSystem(ctx: PromptContext): Promise<string | null> {
    if (ctx.conversationSystemPrompt) return ctx.conversationSystemPrompt;
    const tpl = await this.templateRepo.findDefaultSystem();
    return tpl?.content ?? null;
  }

  private async resolveMemory(ctx: PromptContext): Promise<string | null> {
    // 未来接入 RAG / Memory
    return ctx.retrievedContext ?? null;
  }

  private async resolveTools(ctx: PromptContext): Promise<string | null> {
    // 未来接入 Tool Registry
    return ctx.toolDescriptions ?? null;
  }

  private truncateHistory(history: ChatMessage[], budget: number): ChatMessage[] {
    // 从后向前累加 Token，超出预算时截断
    let used = 0;
    const result: ChatMessage[] = [];
    for (let i = history.length - 1; i >= 0; i--) {
      const tokens = estimateTokens(history[i].content);
      if (used + tokens > budget) break;
      used += tokens;
      result.unshift(history[i]);
    }
    return result;
  }

  /** 渲染模板 */
  async render(templateCode: string, variables: Record<string, string>): Promise<string> {
    const tpl = await this.templateRepo.findByCode(templateCode);
    if (!tpl) throw new Error(`template not found: ${templateCode}`);
    return Object.entries(variables).reduce(
      (acc, [k, v]) => acc.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), v),
      tpl.content,
    );
  }
}

interface PromptContext {
  userId: number;
  conversationId?: number;
  userInput: string;
  history: ChatMessage[];
  conversationSystemPrompt?: string | null;
  retrievedContext?: string | null;
  toolDescriptions?: string | null;
  budget: number; // 剩余 Token 预算
}
```

---

## 5. Prompt 安全

### 5.1 Prompt Injection 检测

- **规则检测**：输入包含 "ignore previous instructions"、"system prompt"、"DAN" 等模式时告警。
- **结构隔离**：System Prompt 与用户输入在消息列表中分离，降低注入成功率。
- **输出过滤**：对模型输出进行敏感信息扫描（身份证号、银行卡、密码等）。

### 5.2 敏感信息过滤

```ts
class PromptSafetyService {
  process(input: string): string {
    return input
      .replace(/\b\d{18}\b/g, '[ID_CARD]')
      .replace(/\b\d{16,19}\b/g, '[BANK_CARD]')
      .replace(/password[:=]\s*\S+/gi, '[PASSWORD]');
  }
}
```

### 5.3 长度控制

- 用户输入超过阈值时拒绝或摘要。
- 最终 Prompt 超过 `contextLength` 时从最早的历史消息开始截断。

---

## 6. Prompt Template 版本管理

### 6.1 表结构扩展

当前 `PromptTemplate` 表：

```sql
CREATE TABLE "PromptTemplate" (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  isDefault BOOLEAN DEFAULT false,
  builtin BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

未来扩展：

```sql
ALTER TABLE "PromptTemplate" ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE "PromptTemplate" ADD COLUMN parentCode TEXT;
ALTER TABLE "PromptTemplate" ADD COLUMN variables JSONB DEFAULT '[]';
ALTER TABLE "PromptTemplate" ADD COLUMN isActive BOOLEAN DEFAULT true;
```

### 6.2 版本控制策略

- 模板更新时创建新版本，旧版本保留。
- `isActive` 标识当前生效版本。
- 支持按 `code + version` 回溯。

---

## 7. 与现有代码的映射

| 新架构 | 当前实现 | 迁移说明 |
|--------|----------|----------|
| System Prompt | `PromptTemplate` (system, isDefault) | 直接复用 |
| Conversation Prompt | `Conversation.systemPrompt` | 直接复用 |
| User Prompt | `Message.content` (user) | 直接复用 |
| Assistant Prompt | `Message.content` (assistant) | 直接复用 |
| Template Prompt | `PromptTemplate` | 增加变量与版本字段 |
| Memory Prompt | 无 | 未来 RAG 接入 |
| Tool Prompt | 无 | 未来 Tool Calling 接入 |
| Agent Prompt | 无 | 未来 Agent 接入 |

---

## 8. 阶段 4 实施建议

1. 创建 `PromptManager` 服务，先封装现有 System Prompt 与 Conversation Prompt 逻辑。
2. 将 `ChatService` 中手动组装的 `messages` 改为调用 `PromptManager.build()`。
3. 引入 `PromptSafetyService`，先做基础敏感信息过滤。
4. 扩展 `PromptTemplate` 表支持版本与变量。
5. 预留 `retrievedContext` 与 `toolDescriptions` 字段，为 RAG / Agent 做准备。
