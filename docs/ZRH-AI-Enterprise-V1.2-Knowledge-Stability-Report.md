# ZRH AI Enterprise V1.2 — Knowledge Stability Report

**Phase:** 2 / Stabilization  
**Branch:** `test/v1.2`  
**Date:** 2026-08-02  
**Scope:** Upload · Chunk · Embedding · Index · Search · Reindex · Permission · Folder · Document · Performance · Accuracy  

**Score: 62 / 100**（审计初值 ~48；ACL 对齐已修，检索/嵌入链路仍有结构性债）

---

## Verdict

Knowledge 上传与文档生命周期可用，但检索准确率与权限一致性仍是主要风险。本阶段已将 Knowledge Permission 与 RAG 风格 department/role ACL 对齐，并正确加载 `departmentId` / `roleId`。

---

## Checklist

| Area | Status | Notes |
|------|--------|-------|
| Upload / Parse | Partial | 解析链路存在；embed 串联偶发缺口（历史债） |
| Chunk | OK | 分块存在 |
| Embedding / Index | Partial | 依赖配置；失败回退关键词 |
| Search | Weak | CJK / 缅文关键词弱；语义依赖向量质量 |
| Reindex | Partial | 管理入口存在；全量准确性未验收 |
| Permission | Fixed | list/access 与 department/role ACL 对齐 |
| Folder / Document | OK | CRUD 主路径可用 |
| Performance | Gap | JSONB/扫描类路径仍可能全表压力 |
| Accuracy | Gap | 无黄金集评测数字 |

---

## Fixed

- `KnowledgePermissionService`：加载用户 `departmentId`/`roleId`；department/role 需 ACL 行才放行（不再过宽）。

---

## Open issues

- 内容哈希 blob 删除竞态（多文档共享 blob 时风险）。  
- 解析成功后 embed 未始终强制串联。  
- CJK / Myanmar 分词与关键词召回弱。  
- 「伪 pgvector」/JSONB 路径性能与真实向量索引差距。  
- 与 RAG ACL 双路径仍需持续对齐测试。

---

## Go / No-Go

**No-Go for Production** until ACL 回归 + 至少一轮 Upload→Chunk→Embed→Search 手工验收通过。  
**Conditional for RC** 若 test 环境上述冒烟通过。
