# Module Improvement Report — Knowledge

**Phase:** Feature Freeze · `test/v1.2`  
**Date:** 2026-08-02  
**Score:** **87 / 100**

## Checklist

| # | Item | Status |
|---|------|--------|
| 1 | 功能完整性 | Pass — 上传/文件夹/权限/检索链路 |
| 2 | Bug 修复 | Pass — 文件夹列表按 ACL 过滤 |
| 3 | 性能 | Pass — 既有索引（R2） |
| 4 | 安全 | Pass — folder department/role 继承 owner 主体；ACL 变更 bump RAG epoch |
| 5–8 | UI/UX/i18n/响应式 | Pass — 既有 Product Polish |
| 9–10 | 重构 / 文档 | Minimal / This report |

## Fixes（本轮）

- `listFolders`：全量拉取后 `canAccessFolder` 过滤（含 SUPER_ADMIN/ADMIN）
- `canAccessFolder`：department/role 与 owner 同部门/同角色
- `grant/revokePermission` + 文档 permission 变更 → `rag:acl:epoch++`

## Residual

- 无独立 Folder ACL 表（部门/角色策略为继承模型）
- 大目录 listFolders N+1 canAccess（P2 可批量）

## Gate

**不得进入 RC**
