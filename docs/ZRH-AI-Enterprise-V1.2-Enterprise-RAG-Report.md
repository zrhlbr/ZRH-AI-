# ZRH AI Enterprise V1.2 — Enterprise RAG Report

**Phase:** 3 / Stabilization  
**Branch:** `test/v1.2`  
**Date:** 2026-08-02  
**Scope:** Rewrite · Retriever · Rerank · Citation · Prompt · Chunk · TopK · Fallback · Cache · Hit rate  

**Score: 68 / 100**（审计初值 ~52）

---

## Verdict

RAG prepare 管线完整（rewrite → retrieve → rerank → compose → cite），Chat 命中注入 / 未命中回退可用。本阶段修正了误导性的 `hitRate` 指标，并将 `minScore` 传入 retriever。仍无查询缓存；rerank 仍为 lexical。

---

## Checklist

| Area | Status | Notes |
|------|--------|-------|
| Rewrite | OK | 存在 |
| Retriever | OK+ | hybrid；现传 `minScore` |
| Rerank | Weak | lexical-only，非 cross-encoder |
| Citation | Partial | 与截断 context 可能不完全一致 |
| Prompt | OK | PromptBuilder |
| Chunk / TopK | OK | retrieveTopK 5–50；rerankTopN=5 |
| Fallback | OK | prepare 失败 → plain chat |
| Cache | Missing | 无查询/embedding 结果缓存 |
| Hit rate | Fixed | 现为 query-level 0\|1（原 fill-ratio 误用） |

---

## Fixed

1. `hitRate` 改为命中布尔量化（0/1），不再用 `ranked.length/topK`。  
2. `prepare()` 将 `minScore` 传入 `retriever.retrieve`。  
3. search 辅助接口同步修正 hitRate 语义。

---

## Open issues

- `/rag/ask` 仍用较低 `minScore=0.05`，与 Chat 默认 `CHAT_RAG_MIN_SCORE≈0.28` 不一致（有意保留低阈值行为，需产品确认）。  
- Citation 可能引用未被最终 context 截断保留的片段。  
- 无 Redis/查询缓存 → 重复问句成本高。  
- Rerank 质量上限低。

---

## Go / No-Go

**Conditional Go for RC**（Chat↔RAG 冒烟通过后）。  
**No-Go for Production** 若 citation 一致性与知识 ACL 回归未签字。
