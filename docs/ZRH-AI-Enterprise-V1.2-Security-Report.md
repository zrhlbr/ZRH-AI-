# ZRH AI Enterprise V1.2 — Security Report

**Phase:** 7 / Stabilization  
**Branch:** `test/v1.2`  
**Date:** 2026-08-02  
**Scope:** RBAC · JWT · Permission · Audit · API · Secrets · .env · Developer Agent · Terminal · Docker · Runner  

**Score: 76 / 100**（审计初值 ~62）

---

## Verdict

企业 RBAC/JWT 骨架健全；本阶段重点堵住 Developer/MCP/Terminal 提权与命令注入面，并禁止 production 硬编码 JWT。仍有 docker.sock（生产 API 只读挂载）与测试密钥管理纪律问题。

---

## Checklist

| Area | Status | Notes |
|------|--------|-------|
| RBAC | OK | USER/VIP/ENTERPRISE/ADMIN/SUPER_ADMIN + permission codes |
| JWT | Fixed | production **要求** `JWT_SECRET`，禁止静默回退 |
| Permission | Improved | Knowledge ACL + Dev workspace ACL |
| Audit | OK | DevAudit / MCP run logs 存在 |
| API | OK | `@RequirePermissions` 广泛使用 |
| Secrets / .env | Improved | 路径拒绝扩展；MCP 禁用默认 runner token |
| Developer Terminal | Fixed | 无 shell 链式；危险命令拒绝 |
| Docker / Runner | Partial | test runner 无 sock；prod API 仍 ro sock |

---

## Fixed

1. Terminal / Runner 命令注入面（metacharacters）。  
2. `allowDangerous` 终端旁路关闭。  
3. MCP → Runner workspace ACL + 强制配置 token。  
4. Diff plan-first；session ownership。  
5. JWT production 强制密钥。  
6. 敏感文件路径策略扩展。

---

## Open / Residual risk

| Risk | Severity | Recommendation |
|------|----------|----------------|
| Prod API `docker.sock:ro` | Medium | 评估改为独立探活或严格 AppArmor |
| Seed / 默认管理员口令 | Medium | test 环境强制改密 |
| Workflow 工具面权限 | Medium | 全量权限矩阵回归 |
| Runner 进程隔离 | Medium | 继续无宿主机 Docker 控制面 |

---

## Go / No-Go

**Conditional Go for RC（安全门槛）** — 关键高危已修。  
**No-Go Production Release** 直至：JWT/密钥检查清单签字 + Developer/MCP 渗透冒烟通过 + 生产 sock 风险接受或缓解。
