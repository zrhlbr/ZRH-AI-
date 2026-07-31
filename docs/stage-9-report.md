# Stage 9 完整验收报告：Workflow Engine（企业级工作流引擎）

> 日期：2026-07-31  
> 基线：Stage 8 PASS（`a281f5b`）  
> 约束：不接入业务系统；不重构 Stage 1–8；不修改 AI Gateway；Workflow 禁止直连外部系统

---

## 一、结论

**Stage 9 Workflow Engine 已完成，建议验收通过。**

架构强制链路：

```
Workflow → Agent Center → Tool Manager → MCP Gateway → External Systems
```

10 个默认 Workflow 模板已种子化；Registry / Designer / Runtime / Scheduler / History / Health / 前端 Workflow Center 均可用。AI Gateway 未改动。

---

## 二、Git Commit SHA

| SHA | 模块 |
|---|---|
| `9dfe07a` | Scaffold：schema / migration / seed |
| `f05fb4e` | Registry / Runtime / Nodes / Scheduler / History / Health APIs |
| `f266c2d` | Frontend Workflow Center + Designer + i18n |
| `64e26ad` | fix：Prisma Json → WorkflowGraph 类型 |
| （本报告） | Acceptance report |

当前 HEAD（报告提交前）：`64e26ad`

---

## 三、修改文件（核心）

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260731180000_stage9_workflow_engine/`
- `backend/prisma/seed.js`
- `backend/src/workflows/**`（新建）
- `backend/src/app.module.ts`（仅新增 WorkflowsModule）
- `frontend/src/api/workflows.ts`
- `frontend/src/pages/WorkflowsPage.tsx`
- 导航 / 图标 / 中缅英 i18n

**未修改：** `backend/src/ai/**`

---

## 四、新增 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/workflows` | 列表 |
| GET | `/api/v1/workflows/:code` | 详情 |
| POST | `/api/v1/workflows` | 创建 |
| PATCH | `/api/v1/workflows/:code` | 编辑 |
| POST | `/api/v1/workflows/:code/enable\|disable` | 启停 |
| DELETE | `/api/v1/workflows/:code` | 删除 |
| POST | `/api/v1/workflows/:code/copy` | 复制 |
| GET | `/api/v1/workflows/:code/export` | 导出 |
| POST | `/api/v1/workflows/import` | 导入 |
| GET | `/api/v1/workflows/templates` | 模板 |
| GET | `/api/v1/workflows/categories` | 分类 |
| POST | `/api/v1/workflows/execute` | 执行（sync/async/queue） |
| GET | `/api/v1/workflows/runs/:id` | 运行详情 |
| POST | `/api/v1/workflows/runs/:id/pause\|resume\|cancel\|approve` | 控制 |
| GET | `/api/v1/workflows/history` | 执行历史 |
| GET | `/api/v1/workflows/logs` | 审计日志 |
| GET/POST | `/api/v1/workflows/scheduler` | 调度 |
| GET | `/api/v1/workflows/health` | 健康 |

---

## 五、新增数据表

- `workflow_categories`
- `workflow_definitions`
- `workflow_runs`
- `workflow_node_runs`
- `workflow_schedules`
- `workflow_audit_logs`

---

## 六、Workflow Registry

支持：创建 / 编辑 / 删除 / 启用 / 停用 / 版本 / 分类 / 导入 / 导出 / 复制 / RBAC（`roleAccess`）

---

## 七、Workflow Designer

前端可视化节点链设计器（Start → … → End）：

- 节点类型：Start / End / Agent / Tool / MCP / Condition / Loop / Delay / Switch / Merge / Approval / Webhook（预留）
- 支持添加 / 移除节点并保存 graph

---

## 八、Workflow Runtime

- 模式：sync / async / queue
- 控制：暂停 / 恢复 / 取消 / 超时 / 重试 / 失败记录
- Approval 节点进入 `waiting_approval`
- **Agent 节点 → AgentRuntime；Tool 节点 → ToolRuntime；MCP 节点 → McpGateway**（无直连）

---

## 九、Workflow Scheduler

- once / cron（`*/N * * * *`）/ interval / event_reserved（拒绝）
- 15s tick 轮询 `nextRunAt`
- 手动 trigger API

---

## 十、Workflow History

记录：执行历史、耗时、节点状态、输入输出、错误、审计日志

---

## 十一、Workflow Templates（10）

| code | 名称 |
|---|---|
| tpl_knowledge_search | 知识检索流程 |
| tpl_document_parse | 文档解析流程 |
| tpl_translation | 多语言翻译流程 |
| tpl_agent_collab | Agent 协作流程 |
| tpl_rag_ask | RAG 问答流程 |
| tpl_document_import | 文档导入流程 |
| tpl_embedding_rebuild | Embedding 重建流程 |
| tpl_toolchain | 工具链调用流程 |
| tpl_mcp_execute | MCP 工具执行流程 |
| tpl_health_patrol | 系统健康巡检流程 |

---

## 十二、Workflow Health

`GET /workflows/health` → `ok: true`（templates ≥ 10 且 enabled ≥ 10）

架构字段：`Workflow → Agent Center → Tool Manager → MCP Gateway → External`

---

## 十三、Docker

| 容器 | 状态 |
|---|---|
| zrh-ai-web | Healthy |
| zrh-ai-api | Healthy |
| zrh-ai-postgres | Healthy |
| zrh-ai-redis | Healthy |

---

## 十四、Build

- API `tsc` 通过
- Web `tsc -b && vite build` 通过

---

## 十五、TypeScript

构建期检查通过。

---

## 十六、性能测试

| 场景 | 结果 |
|---|---|
| tpl_toolchain 单次 | ~55ms |
| tpl_toolchain ×10 | 总 627ms，平均 ~62.7ms |

---

## 十七、安全测试

| 用例 | 结果 |
|---|---|
| Workflow 执行仅经 Agent/Tool/MCP | ✅ 节点执行器强制路由 |
| Webhook 节点 | ✅ reserved，不外呼 |
| MCP 节点 | ✅ 仅 McpGateway stub |
| RBAC | ✅ `api:workflows:*` + `roleAccess` |
| AI Gateway | ✅ 未修改（git diff 验证） |
| 冒烟 | toolchain / health_patrol / mcp_execute → success |

---

## 十八、风险项

1. **Designer** 为结构化节点链 UI，非拖拽画布（无引入 reactflow）。
2. **Cron** 仅支持简化表达式（`*/N * * * *`、整点）。
3. **Queue** 为进程内队列，非分布式 worker。
4. **Approval** 需同进程 resume；多实例需后续加 Redis 协调。
5. **调度执行** 使用 userId=1（超管）作为系统触发身份。
6. **Agent 协作模板** 会调用 LLM，耗时依赖 Ollama。

---

## 十九、是否建议进入 Stage 10（Business Integration Platform）

**建议：可以进入 Stage 10。**

前置已具备：Agent / Tool / MCP / Workflow 平台闭环。Stage 10 业务接入必须继续遵守：

```
Business → Workflow → Agent → Tool → MCP → External
```

禁止业务模块绕过 Workflow / Tool Manager / MCP Gateway 直连外部系统。

---

## 二十、验收清单

| 目标 | 状态 |
|---|---|
| Workflow Registry | ✅ |
| Workflow Designer | ✅ |
| Workflow Runtime | ✅ |
| Workflow Nodes | ✅ |
| Workflow Variables | ✅ |
| Workflow History | ✅ |
| Workflow Scheduler | ✅ |
| Workflow API | ✅ |
| 后台 Workflow Center | ✅ |
| RBAC | ✅ |
| 10 默认模板 | ✅ |
| 禁止直连外部 / 改 Gateway / 重构 1–8 | ✅ |
