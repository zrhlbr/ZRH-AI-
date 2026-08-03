# ZRH AI Enterprise V1.2 — Chat Stability Report

**Phase:** 1 / Stabilization  
**Branch:** `test/v1.2`  
**Date:** 2026-08-02  
**Scope:** AI Gateway · SSE · Streaming · History · Continue · Regenerate · Memory · Conversation · Token · Context · Error recovery · Timeout · Exceptions · Performance · Memory  

**Score: 78 / 100**（审计初值 ~62，本阶段关键缺陷已修）

---

## Verdict

Chat 主链路（Gateway → SSE stream → History/Continue/Regenerate）可用；本阶段已修复模型解析、会话切换污染、Regenerate 破坏性删除等关键问题。仍缺统一流超时、Token 硬截断策略与端到端压测数据。

---

## Checklist

| Area | Status | Notes |
|------|--------|-------|
| AI Gateway | OK | 生成仍经 Gateway，禁止直连 Ollama |
| SSE / Streaming | OK+Fixed | 切换会话时 abort + 忽略错线程 delta |
| History | OK | `HISTORY_LIMIT=30` |
| Continue | OK | 不重检索 RAG；append 原 assistant |
| Regenerate | Fixed | 成功持久化后再删旧 assistant |
| Memory / Conversation | OK | 用户隔离 `userId` |
| Token / Context | Partial | 依赖 params.contextLength/maxTokens；无统一截断审计 |
| 错误恢复 | Partial | RAG 失败回退 plain；stream error 有 SSE error |
| 超时 | Gap | 客户端 Abort；服务端缺统一 idle/total timeout |
| 异常处理 | OK | stop / partial save on abort |
| 性能 / 内存 | Untested live | 无本环境长流压测数字 |

---

## Fixed in this program

1. **`parseModelRef`**：`qwen3:8b` 等 Ollama tag 不再被误拆成 provider。  
2. **前端会话切换**：`openConversation` / `newChat` abort 流，并按 conversation 绑定忽略错线程 UI 更新。  
3. **Regenerate**：服务端先生成再删旧消息；前端保留旧回复直至 `done`。

---

## Open issues（未完全修复）

- 流式缺少服务端 idle / hard timeout 与统一 cancel 指标。  
- Token 超限时无显式截断/提示策略文档化。  
- Continue 后本地与 DB 一致性依赖 `appendToMessageId`，边界 case 需回归。  
- 无生产级长连接内存泄漏实测。

---

## Go / No-Go（Chat 子模块）

**Conditional Go for RC** — 关键路径已稳；RC 前必须在 test 环境完成 send/continue/regenerate/stop/切换会话 回归。
