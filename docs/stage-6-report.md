# Stage 6 完整验收报告：Enterprise RAG Engine

> 日期：2026-07-31  
> 基线：Stage 5 PASS  
> 约束：不开发 Agent / MCP / Workflow；不重构 Stage 1–5；不修改 AI Gateway

---

## 一、结论

**Stage 6 Enterprise RAG Engine 已完成并通过验收。**

管线可用：

```
User Query
  → Query Rewrite
  → Retriever (TopK=20, Keyword/Semantic/Hybrid + Permission Filter)
  → Re-ranking (Top5)
  → Context Composer
  → Prompt Pipeline (System / Memory / Knowledge / Citation / User)
  → AI Gateway.generate（只调用，不修改）
  → Citations + Related Docs + Metrics
```

---

## 二、Git Commit SHA（Stage 6）

| SHA | 模块 |
|---|---|
| `8e6dcc5` | Scaffold + migration/seed |
| `ea2cd56` | Permission Filter |
| `951dcda` | Vector Registry / stubs |
| `c765709` | Embedding Worker |
| `fc2ef69` | Query Rewrite |
| `e9d3fcd` | Retriever |
| `ab89074` | Re-ranking |
| `c3b0b05` | Context Builder |
| `8c4718a` | Prompt Builder |
| `ede8c2f` | Engine + Citation + Memory + API |
| `61d53f6` | Health |
| `ef292cf` | Frontend |
| （本报告 commit） | Acceptance report |

---

## 三、修改文件（核心）

- `backend/src/rag/**`（新建 RAG Engine）
- `backend/prisma/schema.prisma` + `migrations/20260731150000_stage6_enterprise_rag`
- `backend/prisma/seed.js`
- `backend/src/app.module.ts`
- `backend/src/knowledge/knowledge.module.ts`（仅扩展 exports）
- `backend/src/knowledge/documents/document.service.ts`（embedding 交 Worker）
- `frontend/src/api/rag.ts`、`pages/RagPage.tsx`、导航/i18n

---

## 四、新增 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/rag/health` | Embedding / Vector / Retriever 健康 |
| GET | `/api/v1/rag/rewrite?q=` | Query Rewrite |
| GET | `/api/v1/rag/search` | 检索 + 重排 + 引用（不生成） |
| POST | `/api/v1/rag/ask` | 完整 RAG 问答 |

---

## 五、新增数据表

- `departments`
- `users.departmentId`
- `rag_synonyms`
- `rag_query_logs`

---

## 六、RAG 流程图

```
┌────────────┐   ┌──────────────┐   ┌─────────────────────┐
│ User Query │──▶│ Query Rewrite│──▶│ Permission Filter   │
└────────────┘   └──────────────┘   └──────────┬──────────┘
                                               ▼
                                    ┌─────────────────────┐
                                    │ Retriever Top20     │
                                    │ keyword/semantic/   │
                                    │ hybrid + filters    │
                                    └──────────┬──────────┘
                                               ▼
                                    ┌─────────────────────┐
                                    │ Re-rank → Top5      │
                                    └──────────┬──────────┘
                                               ▼
                          ┌────────────────────┴────────────────────┐
                          ▼                                         ▼
                 Context Composer                          Conversation Memory
                          ▼                                         ▼
                 Prompt Pipeline (System/Memory/Knowledge/Citation/User)
                          ▼
                 AIGateway.generate  ←── 不修改 Gateway
                          ▼
                 Answer + Citations + Related + Metrics
```

---

## 七、模块验收

| 模块 | 状态 | 说明 |
|---|---|---|
| Query Rewrite | PASS | 同义词/缩写/业务词/多语言扩展 |
| Retriever | PASS | Keyword/Semantic/Hybrid + TopK/Score/Filter |
| Re-ranking | PASS | Top20 → Top5 |
| Citation | PASS | 文档名/页码/chunk/fileUrl 预留 |
| Memory | PASS | 会话多轮写入 Chat messages |
| Permission | PASS | private/company/department/role/public |
| Prompt Builder | PASS | 五段式 pipeline |
| Context Builder | PASS | 多文档组合 |
| Embedding Worker | PASS | 后台轮询 pending tasks |
| Vector Provider | PASS | JSONB 默认；Milvus/Qdrant/Chroma/FAISS stub |
| Health | PASS | embedding/vector/retriever |
| Frontend | PASS | 引用/相关文档/命中率/耗时 |

---

## 八、Docker / Build / TypeScript

| 检查 | 结果 |
|---|---|
| Backend tsc | PASS |
| Frontend tsc | PASS |
| Docker rebuild api/web | PASS（healthy） |
| `/api/v1/health` | database/redis/ollama online |
| Stage 4 `/api/v1/ai/models` | code=0（兼容） |

---

## 九、性能测试（冒烟）

| 场景 | 结果 |
|---|---|
| `/rag/search` hybrid | ~55 ms（已索引小语料） |
| `/rag/ask` | ~13.3 s（含 LLM generate） |
| rewrite | 同义词扩展成功（5 条 seed） |
| citations | ask 返回 2 条引用 |

说明：ask 耗时主要在 Gateway→Ollama 生成，非检索瓶颈。

---

## 十、安全测试

| 项 | 结果 |
|---|---|
| JWT + `api:rag:*` 权限 | 必需 |
| 越权文档过滤 | RagPermissionService 强制 documentId 白名单 |
| private 文档 | 非 owner / 无显式授权不可检索 |
| Rate limit | ask/search 已限流 |
| AI Gateway | 未修改源码，仅调用 `generate` |

---

## 十一、风险项

1. Re-rank 为轻量词面重排，非 Cross-Encoder；大规模语料可升级模型重排。
2. Vector 仍为 JSONB 全表扫描（刻意保留）；Milvus 等仅 stub。
3. department 依赖 `users.departmentId` + `document_permissions`；未配置部门时 department scope 近似不可达。
4. Embedding Worker 为进程内 setInterval，多实例需后续分布式锁。
5. hitRate 定义为 `rerankCount / retrieveTopK`，小语料时数值偏低属正常。

---

## 十二、是否建议进入 Stage 7（Agent Center）

**建议：可以进入 Stage 7（Agent Center）规划。**

前提：

- Stage 6 RAG Engine 作为 Agent 的知识工具基座已就绪
- 仍禁止在 Stage 6 范围内做 Agent/MCP/Workflow（本阶段已遵守）

---

*Stage 6 验收报告定稿。*
