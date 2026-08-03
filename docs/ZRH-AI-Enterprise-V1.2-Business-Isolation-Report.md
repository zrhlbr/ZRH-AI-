# ZRH AI Enterprise V1.2 — Business Isolation Report

**Phase:** 5 / Stabilization  
**Branch:** `test/v1.2`  
**Date:** 2026-08-02  
**Scope:** ZRHPay · Accounting · Router OS · Knowledge · Workflow · MCP · Business Hub · 接口互不影响  

**Score: 70 / 100**（审计初值 ~55）

---

## Verdict

各业务模块在 Nest 中分模块挂载，主路径互不改写。主要串扰风险来自 **MCP invoke → Dev Runner**（已修 ACL）与共享基础设施（Postgres/Redis/JWT）。未发现 ZRHPay/Accounting/Router OS 被本阶段改动污染 Chat/RAG 业务逻辑。

---

## Isolation matrix（摘要）

| Module A → Module B | Risk | Mitigation / Status |
|---------------------|------|---------------------|
| MCP → Developer workspace | High → Mitigated | Workspace ACL + token 强制 |
| Workflow → Knowledge/RAG | Medium | 共用检索；权限仍依赖各服务 ACL |
| Business Hub → Chat | Low | 独立路由 |
| Developer → Docker host | Medium | test runner 无 sock；prod API 仍 ro sock |
| Shared JWT / DB | Medium | 角色权限隔离；需回归 |

---

## Fixed related to isolation

- MCP filesystem/git 不可再对任意 `workspaceId` 盲调 Runner。  
- Developer Diff/Terminal 写路径收紧，降低误写 workspace 概率。

---

## Open

- Workflow/Agent 工具调用面需完整权限矩阵回归。  
- Business Hub 全接口契约未做自动化契约测试。  
- 共享 DB 迁移（P1/P2）必须只在 test 库执行，禁止碰生产库。

---

## Go / No-Go

**Conditional** — 模块边界可接受进入 RC 测试；**禁止** 与 Production V1.1.0 共用 compose project / volumes。
