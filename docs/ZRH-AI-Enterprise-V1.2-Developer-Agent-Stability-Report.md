# ZRH AI Enterprise V1.2 — Developer Agent Stability Report

**Phase:** 4 / Stabilization  
**Branch:** `test/v1.2`  
**Date:** 2026-08-02  
**Scope:** Workspace · Plan · Diff · Terminal · Runner · Search · Git · Audit · Skills · Memory · Security · Permissions · Dangerous commands · Logs  

**Score: 75 / 100**（审计初值 ~58）

---

## Verdict

Developer Agent P2 骨架可用；本阶段聚焦安全与隔离，未新增大型功能。终端命令链、危险旁路、Plan-first Diff、Session 归属、MCP→Runner ACL、密钥路径拒绝均已收紧。仍需完整手工回归与 Runner 部署验收。

---

## Checklist

| Area | Status | Notes |
|------|--------|-------|
| Workspace | OK | 服务端 workspace + member ACL |
| Plan | OK | plan-first |
| Diff | Fixed | **必须** `planId` 且 approved |
| Terminal | Fixed | 拒绝 metacharacters；禁止 allowDangerous 旁路 |
| Runner | OK (test) | `docker-compose.test.yml` 无 docker.sock |
| Search / Git | OK | 经 runner；危险 git 走专用 API |
| Audit | OK | DevAudit 记录 |
| Skills / Memory | OK | session+skill |
| Security | Improved | 会话归属；密钥路径扩展 |
| MCP 串扰 | Fixed | filesystem/git 需 workspace ACL + 强制 token |

---

## Fixed

1. Runner / Terminal：拒绝 `;|&|$` 等链式字符；terminal 不再接受 dangerous bypass。  
2. Diff：无 approved plan 不可创建。  
3. Orchestrator：session 必须属当前用户（或 SUPER_ADMIN）。  
4. MCP invoke：校验 workspace 成员；要求 `DEV_RUNNER_URL`/`DEV_RUNNER_TOKEN`（禁用默认弱 token）。  
5. 路径策略：扩展拒绝 `.env*`、`credentials.json`、密钥/证书、`.ssh`。

---

## Open issues

- UI 仍有少量英文硬编码（Runner / Index 等）。  
- Runner `shell:true` 仍存在，依赖 metacharacter 拒绝做纵深防御。  
- 生产 compose 仍挂载 docker.sock（API 宿主机探活）— 与 test runner 隔离，但属安全债。  
- 代码索引质量 / lexical-fallback 准确率未测。

---

## Go / No-Go

**Conditional Go for RC（Developer 子模块）** — 仅限 test 栈 + 权限冒烟通过。  
**禁止** 本阶段新增 Developer 功能 / Cursor 专有能力声明。
