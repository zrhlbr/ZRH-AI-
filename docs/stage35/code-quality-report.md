# ZRH AI Stage 3.5 代码质量检查与重构建议

**范围：** `backend/src`（NestJS/Node）、`frontend/src`（React/TypeScript）  
**复查日期：** 2026-07-31  
**总代码行数：** 约 3,870 行  
**整体评价：** 结构清晰、模块分离合理，但 `chat.service.ts` 与 `chatStore.ts` 已超出可维护规模，TypeScript 严格性和前端错误处理需要加强。

---

## 1. 重复代码

### 高

- **Ollama fetch 逻辑重复**
  - `backend/src/chat/chat.service.ts:612-622` 的 `fetchOllama<T>`
  - `backend/src/ollama/ollama.service.ts:33-50` 的 `fetchJson`
  两者都处理 base URL 归一化、超时、JSON 解析、离线回退。
  **建议：** 让 `ChatService` 依赖 `OllamaService` 复用类型化 fetcher。

### 中

- **系统状态轮询重复**
  - `frontend/src/pages/HomePage.tsx:68-100`
  - `frontend/src/components/chat/ChatSidebar.tsx:101-121`
  两者都轮询 CPU/GPU/Docker/Ollama，并使用相同的 `safe()` 辅助函数。
  **建议：** 抽取 `useSystemStatus(intervalMs)` Hook。

- **字节转 GB 格式化重复**
  - `frontend/src/pages/HomePage.tsx:49-53, 277`
  - `frontend/src/components/chat/ChatSidebar.tsx:152`
  - `frontend/src/pages/StatusPage.tsx:96, 176`
  **建议：** 增加共享 `formatBytes(bytes, { decimals, unit })` 工具函数。

- **模型状态颜色映射重复**
  - `frontend/src/components/chat/ChatInput.tsx:22-29`
  - `frontend/src/components/chat/ChatSidebar.tsx:12-21`
  **建议：** 集中到 design-system 或辅助组件。

### 低

- `safe` Promise 包装函数在多处内联定义。

---

## 2. 循环依赖 / 紧耦合

### 中

- **`AuthUser` 类型锚定在 `jwt-auth.guard.ts`**
  - 被 `current-user.decorator.ts`、`permissions.guard.ts`、`chat.service.ts`、`chat.controller.ts`、`auth.controller.ts` 引用。
  **建议：** 将 `AuthUser` 及公共接口迁移到 `backend/src/common/types/auth.types.ts`。

- **`common/` 内装饰器/guard 交叉引用**
  - `permissions.guard.ts` 引用 `public.decorator.ts`、`permissions.decorator.ts`；`jwt-auth.guard.ts` 引用 `public.decorator.ts`。
  **建议：** 将 metadata key 常量集中到 `common/constants.ts`。

### 低

- `frontend/src/api/chat.ts` 引入 `useAuthStore`，API 层依赖状态层；当前可接受，但影响可测试性。

---

## 3. 大组件 / 大 Service

### 高

- **`backend/src/chat/chat.service.ts`（623 行）**
  同时负责 CRUD、模型管理、参数/Prompt 管理、统计、流式输出、中断处理、导出、部分保存恢复。
  **建议：** 拆分为 `ConversationService`、`MessageService`、`ModelService`、`StreamingService`、`ExportService`。

- **`frontend/src/store/chatStore.ts`（436 行）**
  同时管理对话列表、当前聊天、流式状态、模型/参数/Prompt/统计、完整流式编排。
  **建议：** 拆分为 `conversationStore`、`messageStore`、`modelStore`，`chatStore` 仅作为薄 facade。

### 中

- `frontend/src/pages/HomePage.tsx`（290 行）
- `frontend/src/components/chat/ConversationList.tsx`（290 行）
- `frontend/src/pages/ChatPage.tsx`（260 行）

**建议：** 抽取 Hooks 和子组件。

---

## 4. 复杂函数

### 高

- **`ChatService.stream()`**（`backend/src/chat/chat.service.ts:318-589`，约 270 行）
  负责 SSE 设置、对话创建/切换、历史准备、三种模式分支、Prompt 解析、Ollama 流式、NDJSON 解析、中断时部分保存、错误处理。
  **建议：** 拆分为 `buildMessages`、`persistAssistantMessage`、`handleAbort`、`forwardChunk` 等私有方法，或引入流式管道类。

- **`runStream()` in `chatStore.ts`**（`frontend/src/store/chatStore.ts:323-435`，约 115 行）
  处理 abort controller 生命周期、delta 累加、本地消息更新、流结束后副作用。
  **建议：** 抽取事件 reducer 和消息构造辅助函数。

### 中

- `ChatService.modelsStatus()` 嵌套 if/else 链。
- `MarkdownRenderer.tsx` 中 `PreRenderer()` / `textOf()` 递归检查 React 节点并伴随类型断言。

---

## 5. TypeScript 严格性

### 中

- 多个 service/controller 公共方法缺失返回类型：
  - `backend/src/chat/chat.service.ts`：`listConversations`、`getConversation`、`updateConversation`、`deleteConversation`、`exportConversation`、`listModels`、`modelsStatus`、`getParams`、`updateParams`、`listPrompts`、`stats`
  - `backend/src/auth/auth.service.ts:105` `profile`
  - `backend/src/system/system.service.ts` 多个方法
  - `backend/src/auth/auth.controller.ts:14` `meta(req)`
  - `backend/src/ollama/ollama.controller.ts` `health`、`models`

- 多处不安全 `as` 断言：
  - `backend/src/chat/chat.service.ts:283, 481, 618`
  - `backend/src/ollama/ollama.service.ts:43`
  - `backend/src/prisma/prisma.service.ts:32`
  - `frontend/src/api/client.ts:32, 42`
  - `frontend/src/api/chat.ts:248`
  - `frontend/src/components/chat/MarkdownRenderer.tsx:96, 104`

- `backend/src/chat/chat.service.ts:598` `const any = ...` 遮蔽 `any` 类型关键字。

### 低

- 前端函数组件普遍缺少显式返回类型。
- catch 变量隐式 `any`；启用 `useUnknownInCatchVariables` 后需处理。

---

## 6. 错误处理

### 高

- **前端 store 静默吞错**
  - `frontend/src/store/chatStore.ts` 多处空 catch（119、141、154、271-272、277-278、286-287、300-301、311-312）。
  - API 失败不向用户反馈，UI 可能显示为空或卡住。
  **建议：** 至少通过 toast/错误状态暴露错误；生产环境记录到监控服务。

- **流式错误向客户端泄露 Ollama 内部信息**
  - `backend/src/chat/chat.service.ts:582` 发送 `message.slice(0, 300)` 到 SSE。
  **建议：** 内部错误映射为通用用户提示，完整错误仅服务端日志记录。

### 中

- `rawRequest()` 盲目转换 JSON：`frontend/src/api/client.ts:42` 在返回 HTML（如 nginx 错误）时隐藏问题。
- 401 刷新竞争：单例 `refreshing` promise 未安全处理跨 tab/竞态窗口。
- `request()` 超时硬编码 10 秒，长导出可能超时。

---

## 7. 命名与规范

### 中

- `gen` 命名不清晰（`backend/src/chat/chat.service.ts:342`），建议 `activeGeneration`。
- `OllamaChatChunk` 使用 snake_case 字段（由 Ollama API 决定），建议增加映射层。
- `docker(): Promise<Record<string, unknown>>` 返回类型过泛，建议定义 `DockerInfo`。
- 前端 `bytes()` 与 `gb()` 应统一为 `formatBytes()`。

### 低

- 中英注释混用符合团队习惯；公共模块若需外部贡献者可改用英文。

---

## 8. 魔法数字 / 字符串

### 中

- `frontend/src/pages/ChatPage.tsx:17-18` 硬编码侧边栏尺寸：264/200/420/300/240/460。
- 滚动阈值 80/60 像素硬编码。
- 后端多处硬编码超时：3000 ms、4000 ms、5000 ms、10000 ms。
- `chat.service.ts` 中 `.slice(0, 60)`、`.slice(0, 200)`、`.slice(0, 300)` 未命名。

**建议：** 统一抽取到 `timeouts.ts`、`ui-constants.ts` 等配置模块。

---

## 9. 重构优先级

| 优先级 | 行动 |
|---|---|
| **P0** | 拆分 `ChatService`，降低 `stream()` 复杂度 |
| **P0** | 拆分 `chatStore.ts` 并暴露错误而非静默吞错 |
| **P1** | 抽取共享系统状态 Hook 和字节格式化工具 |
| **P1** | 为后端 service/controller 公共方法补充返回类型 |
| **P1** | 替换不安全 `as` 断言为运行时校验或正确类型 |
| **P2** | 集中管理超时与魔法数字常量 |
| **P2** | 将 `AuthUser` 迁移到 `common/types` 降低耦合 |
| **P2** | 强化 401 刷新流程，避免竞态 |
| **P3** | 增加 ESLint 规则（`explicit-function-return-type`、`no-explicit-any`）并启用严格模式检查 |
