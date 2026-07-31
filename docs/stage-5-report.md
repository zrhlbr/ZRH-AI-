# Stage 5 完整验收报告：Knowledge Platform Foundation

> 日期：2026-07-31  
> 基线：Stage 4 `c24086b`  
> 策略：方案 B（WIP Checkpoint → 按模块补齐 → 分 Commit）  
> 约束：不删除、不重写、不重新设计；与 Stage 4 AI Gateway 兼容

---

## 一、结论

**Stage 5 Knowledge Platform Foundation 已完成并通过验收。**

核心链路可用：上传 → 解析 → 分块 → Embedding → 向量入库 → Keyword / Semantic / Hybrid 检索 → 前端知识页。

---

## 二、Git 提交链

| SHA | 说明 |
|---|---|
| `2087cd5` | Stage 5 WIP Checkpoint |
| `a85c034` | Document lifecycle |
| `8cd4876` | Chunk auto strategy |
| `3da5898` | Embedding provider hardening |
| `97ac2d4` | Vector JSONB safety |
| `6252e39` | Retriever permission + response contract |
| `1010d73` | Frontend trash/preview/download/health |
| `2ed0333` | Retriever embedding fallback |
| `6cbc753` | Stage 5 acceptance report（初稿） |
| `3e3c528` / 本文件后续 fix commit | 报告编码修复与定稿 |

---

## 三、完成度（验收后）

| 模块 | 完成度 | 备注 |
|---|---|---|
| Document | 95% | 上传/CRUD/回收站/重解析清理 |
| Folder | 90% | CRUD 完整 |
| Parser | 90% | 10 类格式 |
| Chunk | 90% | auto/fixed/heading + maxChunks |
| Embedding | 90% | Ollama + 重试 + health；依赖 `nomic-embed-text` |
| Vector | 85% | JSONB + 余弦；非原生 pgvector |
| Retriever | 90% | 权限过滤 + hybrid；embedding 失败可降级 |
| Permissions | 75% | public/company/private 可用；role/department 简化 |
| Search | 90% | keyword/semantic/hybrid 验收通过 |
| Storage | 90% | 本地哈希存储 |
| Task | 80% | 状态机可用；无独立 worker |
| Health | 90% | `/knowledge/status` |
| API | 95% | `/api/v1/knowledge/*` |
| Frontend | 90% | 列表/上传/检索/回收站/预览/下载/健康条 |
| Database | 95% | 表已落地 |
| Migration | 95% | 已入库且已进 Git |

---

## 四、新增 / 关键 API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/knowledge/upload` | 上传并触发 parse/chunk/embed |
| GET/POST/PATCH/DELETE | `/api/v1/knowledge/folders` | 文件夹 |
| GET/PATCH/DELETE | `/api/v1/knowledge/documents...` | 文档 CRUD / preview / download / move / copy / restore |
| POST | `/api/v1/knowledge/documents/:id/parse` | 重解析 |
| POST | `/api/v1/knowledge/documents/:id/reindex` | 重建向量 |
| GET | `/api/v1/knowledge/search` | keyword / semantic / hybrid |
| GET | `/api/v1/knowledge/status` | 健康与计数 |
| GET | `/api/v1/knowledge/formats` | 支持格式 |
| POST/DELETE | `/api/v1/knowledge/documents/:id/permissions` | 授权 |

---

## 五、数据表（Stage 5）

- `knowledge_folders`
- `knowledge_documents`
- `knowledge_document_versions`
- `knowledge_chunks`
- `knowledge_tags` / `knowledge_document_tags`
- `knowledge_vectors`（JSONB embedding）
- `embedding_providers` / `vector_providers`
- `embedding_tasks`
- `document_permissions`

Migration：`20260731065502_stage5_knowledge_platform`

---

## 六、测试结果

| 检查项 | 结果 |
|---|---|
| Backend `tsc` | 通过 |
| Frontend `tsc` + Vite build | 通过 |
| Docker `zrh-ai-api/web` rebuild | healthy |
| `/api/v1/health` | database/redis/ollama online |
| 登录 + Knowledge 权限 | 通过 |
| 上传 Markdown | status → chunked → indexed |
| Keyword search | 通过 |
| Semantic / Hybrid search | 通过（需 `nomic-embed-text`） |
| `/api/v1/ai/models`（Stage 4） | 兼容，code=0 |
| 前端 `http://localhost:3010` | HTTP 200 |

冒烟摘要：

- documents=2, chunks=2, vectors=2
- embedding provider online
- hybrid 命中 smoke 文档（score ≈ 0.70）

---

## 七、风险与后续

1. Embedding 模型依赖：需本机 Ollama 存在 `nomic-embed-text`；未安装时 semantic 降级为 keyword。
2. 向量全表扫描：JSONB + 应用层余弦，数据量大时需升级真 pgvector / 索引。
3. 权限简化：department / role 细粒度仍属后续增强。
4. 无独立任务 Worker：embedding 当前为进程内异步；进程重启可能丢未完成任务。
5. `_prisma_migrations` 历史残留：存在一条已 rollback 的同名 Stage 5 记录，不影响当前运行。

---

## 八、与 Stage 4 兼容性

- 未修改 AI Gateway / Model Router / Provider 核心行为
- Knowledge 为独立 Nest 模块
- 仅复用 `OLLAMA_BASE_URL` 与既有 JWT/RBAC/限流
- AI models API 冒烟通过

---

## 九、是否建议进入下一阶段

**建议：Stage 5 Foundation 可结项。**

下一阶段可考虑：

- 真 pgvector / 向量索引
- Embedding 任务队列
- Chat + Knowledge RAG 对接（在 Gateway 之上）
- 权限模型完善

---

*Stage 5 验收报告定稿。*
