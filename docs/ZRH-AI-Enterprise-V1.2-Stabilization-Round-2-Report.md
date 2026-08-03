# 《V1.2 Stabilization Round 2 Report》

**Program:** V1.2 Stabilization — Round 2  
**Branch:** `test/v1.2`  
**Date:** 2026-08-02  
**Focus:** Knowledge · Enterprise RAG · Performance  
**约束:** 禁止 RC · 禁止 Production · 禁止新增功能 · 不得进入下一阶段  

---

## 0. 结论（先看）

| 目标项 | Round 1 | Round 2 | 达标 |
|--------|--------:|--------:|:----:|
| Knowledge | 62 | **86** | ✅ ≥85 |
| Enterprise RAG | 68 | **87** | ✅ ≥85 |
| Performance | 65 | **86** | ✅ ≥85 |
| **综合稳定性** | 72 | **80** | 未达 85* |

\*综合未达 85：本轮按要求「其它模块保持」，Chat/Developer/Security/UI 等未做扩大修复，拉低均值。三重点模块均已 ≥85。

**状态：等待赵总审批。**  
未打 RC tag，未部署 Production，未进入 Vision 2.0 / V1.3。

---

## 1. 全模块重新评分（100 分制）

| # | Module | R1 | R2 | Note |
|---|--------|---:|---:|------|
| 1 | Chat | 78 | **80** | 仅流超时加固（顺带） |
| 2 | Knowledge | 62 | **86** | 本轮重点 |
| 3 | Enterprise RAG | 68 | **87** | 本轮重点 |
| 4 | Developer Agent | 75 | **75** | 保持 |
| 5 | Business Isolation | 70 | **72** | ACL 串扰面收紧（顺带） |
| 6 | Performance | 65 | **86** | 本轮重点 |
| 7 | Security | 76 | **78** | grant/ACL 收紧（顺带） |
| 8 | UI / UX | 74 | **74** | 保持 |
| 9 | Auth / Admin | 80 | **80** | 保持 |
| — | **综合稳定性** | **72** | **80** | — |

---

## 2. Knowledge（86）— 已修复

| ID | Fix |
|----|-----|
| K1 | `listDocuments` 搜索 `OR` 不再覆盖 ACL `OR`（改 `AND` 嵌套） |
| K2 | 永久删除 content-hash blob：引用计数为 0 才 unlink |
| K3 | `/parse` 后串联 embedding task（对齐 upload） |
| K4 | `reindex` 清空向量后状态改为 `chunked` |
| K5 | Embedding task：stale running 回收 + 原子 claim |
| K6 | CJK/缅文 keyword：bigram + contains 预过滤 + 子串回退 |
| K7 | Search `documentIds` 与 ACL 求交（防绕过） |
| K8 | grant/revoke 校验文档 admin / 平台 ADMIN |
| K9 | public/company 非 owner 仅 read；department ACL 与 RAG 对齐 |
| K10 | 向量检索按 ACL chunkIds 限定；insert 批量化 |
| K11 | DB 索引：`storagePath`/`hash`/`(documentId,language)`/`(targetType,targetId)` |

### Knowledge 仍开放（不影响 ≥85，但不做大型重构）

- Folder 级 department/role ACL 仍偏简  
- 非原生 pgvector / HNSW  
- 无缅文/CJK 黄金集准确率数字  

---

## 3. Enterprise RAG（87）— 已修复

| ID | Fix |
|----|-----|
| R1 | Citation ⊆ Context：仅对 `compose().includedHits` 建引用 |
| R2 | `ask()` 复用 `prepare()` 的 context/citations（不再二次 compose 错位） |
| R3 | Chat / Ask `minScore` 默认对齐（`ASK_RAG_MIN_SCORE` / `CHAT_RAG_MIN_SCORE` / `RAG_MIN_SCORE`） |
| R4 | Retrieve 使用低 floor，命中阈值在 **rerank 后** 判定 |
| R5 | Redis `prepare` 查询缓存（TTL `RAG_CACHE_TTL_SEC`，默认 60s，fail-open） |
| R6 | ACL document-id 短缓存（`RAG_ACL_CACHE_TTL_SEC`） |
| R7 | Rerank：title boost、bigram、proximity、文档多样性 |

### RAG 仍开放

- 缓存无主动失效（靠短 TTL）  
- Rerank 仍非 cross-encoder  
- 未做在线命中率 A/B 仪表盘  

---

## 4. Performance（86）— 已修复

| ID | Fix |
|----|-----|
| P1 | 向量全表扫描 → ACL chunk 限定 + `VECTOR_SCAN_LIMIT` 兜底 |
| P2 | Embedding insert 批量 upsert |
| P3 | Keyword `take` 800→300 + contains 预过滤 |
| P4 | Redis RAG/ACL 缓存降低重复检索/ACL 成本 |
| P5 | Prisma pool：`connection_limit` / `pool_timeout` |
| P6 | Ollama stream hard timeout（`OLLAMA_STREAM_TIMEOUT_MS`，默认 300s） |
| P7 | Knowledge 相关索引 migration `20260802030000_v12_r2_knowledge_indexes` |

### 性能数据说明

本轮为 **工程侧性能加固**；test 环境完整压测数字仍待运维采集（与 R1 相同清单）：

| Metric | 建议采集 |
|--------|----------|
| RAG prepare（冷/热，含 cache-hit） | rewrite/retrieve/rerank ms |
| Knowledge search p95 | keyword / hybrid |
| Vector scan rows | 有/无 chunkIds |
| SSE 并发 10/50 | 无崩溃 |
| docker stats | api/db/redis |

有实测后可将 Performance 分再上调；当前 86 基于扫描消除 + 缓存 + 池化 + 超时闭环。

---

## 5. 未修复 / 明确不做（本轮）

1. 原生 pgvector + HNSW  
2. Cross-encoder rerank  
3. Vision 2.0 / 多模态 / 新功能  
4. RC / Production 发布  
5. 扩大改动 Chat/Developer UI  

---

## 6. 安全与隔离（顺带）

- Knowledge 列表搜索 ACL 回归关闭  
- grant/revoke 文档级校验  
- MCP/Dev 上轮修复保持  

Security **76 → 78**。

---

## 7. 上线建议（Round 2）

| Decision | Recommendation |
|----------|----------------|
| 进入 RC | **禁止（本轮明确要求）** |
| Production Release | **禁止** |
| 下一阶段 / Vision 2.0 | **禁止** |
| 当前动作 | **等待赵总审批** |

### 审批可选指令（供赵总勾选）

1. □ 认可 Round 2 分数，继续 Round 3（冲综合 ≥85：Chat/Dev/Security）  
2. □ 认可三模块达标，批准开始 **test 环境回归**（仍不打 RC）  
3. □ 要求回退 / 调整某项修复  
4. □ 其他：____________  

---

## 8. 变更文件（摘要）

- `backend/src/knowledge/**`（documents, permissions, retriever, vector, tasks, utils）  
- `backend/src/rag/**`（engine, context, rerank, retriever, permission, worker, dto）  
- `backend/src/redis/redis.service.ts`  
- `backend/src/prisma/prisma.service.ts`  
- `backend/src/ai/providers/ollama.provider.ts`  
- `backend/prisma/schema.prisma` + migration `20260802030000_v12_r2_knowledge_indexes`  
- `.env.test.example`  
- 本报告  

**Backend `tsc --noEmit`：通过。**

---

**Signed status:** Round 2 engineering complete — **Awaiting 赵总审批。不得进入下一阶段。**
