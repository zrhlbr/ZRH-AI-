# ZRH AI Enterprise V1.2 P1 Development Report

**模块：** User Center · Admin Platform · Super Admin Platform  
**基线：** ZRH AI Enterprise v1.1 Production Ready  
**状态：** P1 **验收通过** → 已提交至独立测试线 — **不部署生产 / 不进入下一阶段**  
**报告日期：** 2026-08-02

---

## 1. 原则与边界（已遵守）

| 约束 | 结果 |
|------|------|
| 不修改 AI Gateway / Enterprise RAG / Knowledge / Workflow / Agent / MCP / Business Hub / Chat 业务逻辑 | ✅ 未改业务代码 |
| 不修改生产 Docker 默认镜像标签 | ✅ `docker-compose.production.yml` 默认仍 `1.1.0` |
| 不破坏已有业务表结构 | ✅ 仅 **ADD COLUMN**（users.email/phone…）+ 新建表 |
| 不修改 V1.1 Production | ✅ 未部署生产；`main` 保留 V1.1 线 |
| V1.1 登录兼容 | ✅ `/auth/login` 仍支持 `username`；新增 `account` / Remember Me |

---

## 2. Git Commit

| 项 | 值 |
|----|-----|
| V1.1 产品冻结 | `5244b4f6e26d8a607367205d558dc867ea13d27d`（tag `v1.1.0`） |
| 分支 | `test/v1.2`（独立测试线） |
| Commit | `49faadea87883d9b95903a1741e2f56866401c12` |
| Commit message | `feat(v1.2): user center and enterprise admin platform` |
| Test tag | `v1.2.0-test` |
| `main` | `2888b59`（未前进） |
| Production tag `v1.2.0` | **未打**（测试完整验收后再决定） |
| Production deploy | **未执行** |

详见：`docs/ZRH-AI-Enterprise-v1.2-Test-Version.md` · `.env.test.example`。

---

## 3. 数据库迁移

**文件：** `backend/prisma/migrations/20260802010000_v12_p1_user_center/migration.sql`

### 3.1 User 表增量字段

- `email` (unique, nullable)
- `phone` (unique, nullable)
- `emailVerifiedAt`
- `phoneVerifiedAt`

### 3.2 新表

| 表 | 用途 |
|----|------|
| `user_profiles` | 昵称 / 头像 / 国家 / 语言 / 简介 |
| `user_login_logs` | 登录历史 |
| `user_devices` | 登录设备 |
| `user_sessions` | 会话（含 Remember Me） |
| `user_notifications` | 用户通知 |
| `system_announcements` | 系统公告 |
| `system_configs` | 系统配置（Super Admin） |
| `password_reset_tokens` | 找回密码 |
| `verification_codes` | 邮箱/手机验证码 |
| `invite_codes` | 邀请码 |

### 3.3 应用方式（验收环境）

```bash
cd backend
npx prisma migrate deploy
npx prisma db seed
```

Seed 幂等：角色 `SUPER_ADMIN / ADMIN / USER / VIP / ENTERPRISE` + V1.2 权限码。

---

## 4. API

### 4.1 Auth（公开 + 管理）

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/v1/auth/login` | V1.1 `username` 兼容；V1.2 `account` + `rememberMe` |
| POST | `/api/v1/auth/login/v12` | 显式 V1.2 登录 |
| POST | `/api/v1/auth/register` | 用户名/邮箱/手机注册 |
| POST | `/api/v1/auth/send-code` | 邮箱验证码；手机通道预留 |
| POST | `/api/v1/auth/forgot-password` | 邮箱找回；手机预留 |
| POST | `/api/v1/auth/reset-password` | Token 重置密码 |
| POST | `/api/v1/auth/admin/reset-password/:userId` | 管理员重置（需 `api:users:admin`） |

### 4.2 User Center

| Method | Path | 权限 |
|--------|------|------|
| GET/PATCH | `/api/v1/user-center/me` | `api:user-center:read/write` |
| POST | `/api/v1/user-center/change-password` | write |
| GET | `/api/v1/user-center/login-history` | read |
| GET | `/api/v1/user-center/devices` | read |
| POST | `/api/v1/user-center/devices/:deviceId/revoke` | write |
| GET | `/api/v1/user-center/sessions` | read |
| GET | `/api/v1/user-center/notifications` | read |
| GET | `/api/v1/user-center/api-tokens` | **预留** |

### 4.3 Admin

| Method | Path | 权限 |
|--------|------|------|
| GET | `/api/v1/admin/dashboard` | `api:admin:read` |
| GET | `/api/v1/admin/users` | `api:users:read` |
| PATCH | `/api/v1/admin/users/:id/status` | `api:users:admin` |
| PATCH | `/api/v1/admin/users/:id/role` | `api:users:admin` |
| GET | `/api/v1/admin/roles` | `api:roles:read` |
| GET | `/api/v1/admin/permissions` | `api:roles:read` |
| GET/POST | `/api/v1/admin/announcements` | read / `api:admin:write` |

Dashboard 含：今日用户、在线会话、AI/Token（计量预留）、CPU/GPU/Memory/Docker、模块开关。

### 4.4 Super Admin（运行时强制 `role === SUPER_ADMIN`）

| Method | Path | 权限 |
|--------|------|------|
| GET | `/api/v1/superadmin/overview` | `api:superadmin:read` |
| GET/POST | `/api/v1/superadmin/configs` | read / write |
| GET | `/api/v1/superadmin/logs` | **预留** |
| GET | `/api/v1/superadmin/ops` | backup/restore/upgrade **预留** |
| GET | `/api/v1/superadmin/integrations` | Cloudflare/SMTP/OAuth/AI Provider/License **预留** |

---

## 5. 页面（Frontend）

| 路由 | 页面 |
|------|------|
| `/login` | 登录中心（账号/邮箱/手机、Remember Me、三语言） |
| `/register` | 注册中心（验证码、邀请码、协议/隐私） |
| `/forgot-password` | 忘记密码 / 重置 |
| `/account` | 用户中心（资料、密码、设备、历史、API Token 预留） |
| `/admin/*` | Admin Dashboard + 用户/角色/权限/公告 + 业务管理壳层 |
| `/superadmin/*` | Super Admin（概览、配置、运维/集成/日志预留） |

UI：黑金科技风；i18n：`zh-CN` / `my-MM` / `en-US`。

---

## 6. 权限（RBAC）

### 6.1 角色

`USER` · `VIP` · `ENTERPRISE` · `ADMIN` · `SUPER_ADMIN`

### 6.2 新增权限码

- `menu:account` / `menu:admin` / `menu:superadmin`
- `api:user-center:read|write`
- `api:users:read|admin` · `api:roles:read`
- `api:admin:read|write`
- `api:superadmin:read|write`

### 6.3 矩阵摘要

| 角色 | User Center | Admin | Super Admin |
|------|-------------|-------|-------------|
| USER / VIP / ENTERPRISE | ✅ | ❌ | ❌ |
| ADMIN | ✅ | ✅（无 superadmin） | ❌ |
| SUPER_ADMIN | ✅ | ✅ | ✅ |

---

## 7. Docker

| 项 | 说明 |
|----|------|
| Compose / Dockerfile | **未修改** |
| 生产镜像 | 仍保持 `zrh-ai-api:1.1.0` / `zrh-ai-web:1.1.0` |
| 部署建议 | 验收通过后单独构建 **1.2.0** 标签；先 staging 再生产 |

---

## 8. Build / Health（本地校验）

| 检查 | 结果 |
|------|------|
| `npx prisma generate` | ✅ |
| Backend `tsc --noEmit`（tsconfig.build） | ✅ |
| Frontend `tsc --noEmit` | ✅ |
| 生产 Docker rebuild / 线上 deploy | ⏸ **未执行**（保护 V1.1 Production） |
| `/api/v1/health` 生产实测 | ⏸ 待验收环境部署后验证 |

---

## 9. 风险

1. **邮箱/短信通道未接 SMTP/SMS**：验证码与重置 token 写入服务端日志（非生产可返回 `devCode`/`devToken`）。
2. **AI 请求 / Token 计量**：Dashboard 字段为预留（0 + note），不影响 V1.1 Chat。
3. **Admin 业务菜单**：Knowledge/Agent/Workflow 等为管理壳层，真实业务仍走 V1.1 页面，避免双写。
4. **迁移未上生产**：需在维护窗口执行 `migrate deploy` + `seed`；建议先备份 PostgreSQL。
5. **ADMIN 角色矩阵变宽**：seed 全量重建 role-permission；部署后需确认现有 ADMIN 账号权限符合预期。
6. **未提交 Git**：验收前代码仅在工作区，避免误推 main。

---

## 10. 验收清单（建议）

- [ ] `migrate deploy` + `seed` 成功
- [ ] 注册（邮箱验证码）→ 登录 → `/account` 改资料/改密
- [ ] Remember Me 拉长 refresh 会话
- [ ] 忘记密码（devToken）→ 重置 → 重新登录
- [ ] ADMIN：`/admin` Dashboard、用户启用/停用、角色、公告
- [ ] SUPER_ADMIN：`/superadmin` 配置读写；非 SUPER_ADMIN 403
- [ ] 三语言切换正常
- [ ] V1.1 Chat / Knowledge / RAG / Agent / Workflow / MCP / Business 回归无回归问题
- [ ] `/api/v1/health` = ok

---

## 11. 结论

**V1.2 P1 开发完成，进入验收闸门。**  
未修改 V1.1 业务逻辑与 Docker；未部署生产。  
请验收通过后再决定 Git 提交与 1.2.0 镜像发布。  
**不自动进入下一阶段。**
