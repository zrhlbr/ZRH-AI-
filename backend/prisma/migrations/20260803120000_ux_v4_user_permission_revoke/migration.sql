-- UX V4.0（用户端彻底重构）：回收 USER / VIP 角色的企业级权限。
-- 回收后，普通用户访问 Developer / MCP / Workflow / Business / Server / System /
-- Health / Monitor 等企业 API 时，由全局 PermissionsGuard 返回 403 Forbidden。
-- ADMIN / SUPER_ADMIN / ENTERPRISE 角色不受影响（后台功能全部保留）。
-- 该迁移与 prisma/seed.js 中新的 USER_BASE_PERMISSIONS 保持一致；
-- 仅删除 role_permissions 授权行，不改动任何表结构，可随时通过重新 seed 恢复。

DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = p."id"
  AND r."code" IN ('USER', 'VIP')
  AND p."code" IN (
    -- 系统状态 / 服务器监控
    'menu:status',
    'button:status:refresh',
    'api:system:cpu',
    'api:system:memory',
    'api:system:network',
    'api:system:storage',
    'api:system:docker',
    'api:ollama:read',
    'api:ai:read',
    -- 知识平台
    'menu:knowledge',
    'api:knowledge:read',
    'api:knowledge:write',
    'api:knowledge:delete',
    -- 企业 RAG
    'menu:rag',
    'api:rag:read',
    'api:rag:write',
    -- Agent Center
    'menu:agents',
    'api:agents:read',
    'api:agents:chat',
    -- Tool Center
    'menu:tools',
    'api:tools:read',
    'api:tools:execute',
    -- MCP Center
    'menu:mcp',
    'api:mcp:read',
    -- Workflow Center
    'menu:workflows',
    'api:workflows:read',
    'api:workflows:execute',
    -- Business Hub
    'menu:business',
    'api:business:read',
    'api:business:execute',
    -- Developer
    'menu:developer',
    'api:developer:read',
    'api:developer:chat'
  );
