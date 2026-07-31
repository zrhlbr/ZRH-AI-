# Stage 8 完整验收报告：MCP & Tool Calling Platform

> 日期：2026-07-31  
> 基线：Stage 7 PASS（`62616a9`）  
> 约束：不开发 Workflow；不接入业务系统；不修改 AI Gateway；不重构 Stage 1–7

---

## 一、结论

**Stage 8 MCP & Tool Calling Platform 已完成，建议验收通过。**

企业 Tool 统一经 Tool Manager（Registry / Runtime / Calling / Router）执行；MCP 统一经 MCP Gateway / Registry 管理。第一批 10 个内置 Tool 已上线；10 个 MCP Connector 为 reserved stub 框架。AI Gateway 未改动。

---

## 二、Git Commit SHA

| SHA | 模块 |
|---|---|
| `582fc95` | Scaffold：schema / migration / seed |
| `8c088fd` | Tool Registry / Runtime / Calling / Router / Health / Logs + 10 builtins |
| `fcfb84e` | MCP Registry / Gateway stubs / Sessions / Health / Logs |
| `3d6fd84` | Frontend Tool Center + MCP Center + 三语言 |
| `388de4a` | fix：Prisma Json 类型 |
| （本报告） | Acceptance report |

当前 HEAD（报告提交前）：`388de4a`

---

## 三、修改文件（核心）

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260731170000_stage8_tools_mcp/migration.sql`
- `backend/prisma/seed.js`
- `backend/src/tools/**`（新建）
- `backend/src/mcp/**`（新建）
- `backend/src/app.module.ts`（仅新增 ToolsModule / McpModule 导入）
- `frontend/src/api/tools.ts` / `frontend/src/api/mcp.ts`
- `frontend/src/pages/ToolsPage.tsx` / `frontend/src/pages/McpPage.tsx`
- `frontend/src/main.tsx` / `AppShell.tsx` / `icons.ts`
- `frontend/src/i18n/locales/{zh-CN,en-US,my-MM}.json`

**未修改：** `backend/src/ai/**`（AI Gateway 保持稳定）

---

## 四、新增 API

### Tool API `/api/v1/tools/`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/tools` | Tool 列表 |
| GET | `/tools/:code` | 详情 |
| POST | `/tools` | 创建 |
| PATCH | `/tools/:code` | 编辑 |
| POST | `/tools/:code/enable` | 启用 |
| POST | `/tools/:code/disable` | 禁用 |
| DELETE | `/tools/:code` | 删除（非 builtin） |
| GET | `/tools/categories` | 分类 |
| GET | `/tools/permissions` | RBAC 矩阵 |
| GET | `/tools/route` | Tool Router |
| POST | `/tools/execute` | Runtime 执行（sync/async/streaming） |
| POST | `/tools/call` | LLM Tool Calling 编排 |
| GET | `/tools/logs` | 运行日志 |
| GET | `/tools/health` | 健康 |

### MCP API `/api/v1/mcp/`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/mcp/servers` | MCP Server 列表 |
| GET | `/mcp/servers/:code` | 详情 |
| PATCH | `/mcp/servers/:code` | 编辑 |
| POST | `/mcp/servers/:code/enable` | 启用 |
| POST | `/mcp/servers/:code/disable` | 停用 |
| DELETE | `/mcp/servers/:code` | 删除（非 builtin） |
| POST | `/mcp/connect` | 建立 Session（stub） |
| POST | `/mcp/disconnect` | 断开 Session |
| POST | `/mcp/invoke` | stub invoke |
| GET | `/mcp/sessions` | 活跃会话 |
| GET | `/mcp/logs` | 日志 |
| GET | `/mcp/health` | 健康 |

---

## 五、新增数据表

- `tool_categories`
- `tool_definitions`
- `tool_run_logs`
- `mcp_servers`
- `mcp_sessions`
- `mcp_run_logs`

---

## 六、Tool Registry

- 支持创建 / 编辑 / 删除 / 启用 / 禁用 / 版本 / 分类 / 权限 / 健康
- 种子分类 5 个：knowledge / language / developer / system / data
- 默认 10 个 builtin Tool（全部 enabled）

| code | name |
|---|---|
| knowledge_search | Knowledge Search |
| rag_search | RAG Search |
| document_parser | Document Parser |
| translation | Translation |
| code_execute | Code Execute（沙箱） |
| file_manager | File Manager |
| http_request | HTTP Request |
| database_query | Database Query（只读） |
| system_health | System Health |
| calculator | Calculator |

---

## 七、Tool Runtime

统一执行引擎，支持：

- sync / async（框架接受，当前 inline）/ streaming（单 chunk 结果）
- Timeout（per-tool `timeoutMs`）
- Retry（`maxRetries`）
- 参数校验（inputSchema）
- 运行日志写入 `tool_run_logs`

---

## 八、Tool Calling

- `POST /tools/call`：Router 选 Tool →（可选）LLM 生成参数 → Runtime 执行 → 返回结果/错误
- 通过 `AIGateway.generate` 生成参数，**不修改 Gateway 内部**

冒烟：`calculate 7+8` → status=success，result=15

---

## 九、MCP Gateway

- 统一 Session / Transport / Health / Logs
- Stage 8 transport 以 `stub` 为主；connect 创建框架会话，不建立真实外部协议连接

---

## 十、MCP Registry

第一批 10 个 Connector（reserved，默认 disabled）：

GitHub / GitLab / PostgreSQL / MySQL / Redis / Docker / Ollama / Filesystem / Web Search / Browser

支持启用 / 停用 / 状态 / 权限 / 版本。

冒烟：enable `filesystem` → connect → session connected → disconnect OK

---

## 十一、Tool Router

按 Agent 默认工具集 + 任务关键词路由。

冒烟：`calculate 12*(3+4)` → `calculator`

---

## 十二、Tool Health

`GET /tools/health` → `ok: true`（enabled ≥ 10）  
`GET /mcp/health` → `ok: true`（servers ≥ 10）

---

## 十三、Docker

| 容器 | 状态 |
|---|---|
| zrh-ai-web | Healthy（3010） |
| zrh-ai-api | Healthy（4010） |
| zrh-ai-postgres | Healthy（5440） |
| zrh-ai-redis | Healthy（6380） |

---

## 十四、Build

- API：`tsc -p tsconfig.build.json` 通过（Docker 构建）
- Web：`tsc -b && vite build` 通过（Docker 构建）

---

## 十五、TypeScript

构建期 TypeScript 检查通过；Prisma Json 字段已按 `InputJsonValue` 收口。

---

## 十六、性能测试

| 场景 | 结果 |
|---|---|
| calculator 单次 | latencyMs ≈ 1ms |
| calculator ×20 | 总耗时 248ms，平均 ≈ 12.4ms |

---

## 十七、安全测试

| 用例 | 结果 |
|---|---|
| HTTP Request 访问 `example.com` | **拦截**（host not in allowlist） |
| Code Execute `process.exit(1)` | **拦截**（unsafe characters） |
| File Manager `../..` | **拦截**（path traversal not allowed） |
| Database Query | 仅只读统计 metric，无任意 SQL |
| RBAC | `api:tools:*` / `api:mcp:*` + tool `roleAccess` |
| JWT | 全局守卫，未授权不可访问 |

---

## 十八、风险项

1. **MCP 连接器均为 stub**：真实 GitHub/DB/Browser 协议未实现，仅框架与 Session。
2. **async/streaming**：接口已接受 mode，尚未接入独立队列/SSE 流。
3. **HTTP allowlist** 较严（localhost/ollama 等），生产需可配置白名单。
4. **Code Execute** 仅算术表达式沙箱，非完整语言运行时。
5. **Agent Runtime 尚未强制改走 Tool Manager**：Stage 8 平台已就绪；Agent 侧逐步切换可在后续小步完成（未重构 Stage 7）。

---

## 十九、是否建议进入 Stage 9（Workflow Engine）

**建议：可以进入 Stage 9。**

前置条件已满足：

- Tool Calling 平台可用
- MCP Gateway 框架就绪
- Stage 1–8 架构稳定
- AI Gateway 未被污染

Stage 9 应在 **不绕过 Tool Manager / MCP Gateway** 的前提下设计 Workflow；禁止直接调用外部工具。

---

## 二十、验收清单（对照目标）

| 目标 | 状态 |
|---|---|
| Tool Registry | ✅ |
| Tool Runtime | ✅ |
| Tool Calling | ✅ |
| MCP Gateway | ✅（框架） |
| MCP Registry | ✅（stub connectors） |
| Tool Router | ✅ |
| Tool API | ✅ |
| MCP API | ✅ |
| 后台 Tool/MCP Center | ✅ |
| RBAC | ✅ |
| 10 Builtin Tools | ✅ |
| 10 MCP Connectors 预留 | ✅ |
| 禁止 Workflow / 业务接入 / 改 Gateway / 重构 1–7 | ✅ |
