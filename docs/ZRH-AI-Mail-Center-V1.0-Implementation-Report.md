# ZRH AI Mail Center V1.0 Implementation Report

**Branch:** `test/v1.2`  
**Scheme:** B（独立 `mail_templates` / `mail_send_logs` + `system_configs` SMTP/策略）  
**Status:** Implemented on test branch — **awaiting 赵总验收**；**未部署 Production**  
**Date:** 2026-08-02  

---

## 1. Approval confirmation

已按批准执行方案 B，并落实 SMTP 未配置处理规则：

| 环境 | SMTP 未配置 | `devCode` / 日志明文验证码 |
|------|-------------|---------------------------|
| Production (`NODE_ENV=production`) | 明确返回 **「邮件服务尚未配置」**；禁止假装发送成功 | **禁止** `devCode`；**禁止**生产日志输出验证码明文 |
| Development / Test | 同上错误，除非显式开启开关 | 仅当 `MAIL_DEV_CODE_ENABLED=true`（**默认 false**）允许 log + `devCode` |

---

## 2. Scope & non-goals

**In scope**
- Prisma：`mail_templates`、`mail_send_logs`
- `system_configs`：SMTP Host/Port/Username/加密 Password/Encryption/From/Reply-To/Timeout + 验证码策略
- Nest `MailModule`：AES-GCM 密码、nodemailer、模板、发送日志、Super Admin API
- 认证 `sendCode` / `forgotPassword` 接入邮件通道
- Super Admin 前端「邮件中心」页 + zh/en/my i18n
- Env 示例：`MAIL_CONFIG_CRYPTO_KEY`、`MAIL_DEV_CODE_ENABLED=false`

**Out of scope / untouched**
- Chat、RAG、Knowledge、Workflow、Agent、MCP、Business、Developer
- Production 部署

---

## 3. Data model

### 3.1 `mail_templates`
- type / locale（zh-CN、en-US、my-MM）/ subject / htmlBody / textBody / variables / enabled / version / updatedAt  
- 唯一键：`(type, locale)`

### 3.2 `mail_send_logs`
- toMasked、templateType、status、provider、messageId、attempts、errorCode、errorMessage（脱敏）、userId、requestIp、createdAt、completedAt  
- **不记录**验证码正文、SMTP 密码、Token 明文

### 3.3 `system_configs` keys
- `mail.smtp.*`（含 `mail.smtp.password` secret=true，AES `v1:` 密文）
- `mail.code.length|ttlSeconds|intervalSeconds|dailyLimit|maxRetries`

Migration：`backend/prisma/migrations/20260802170000_mail_center_v1/migration.sql`

---

## 4. API（SUPER_ADMIN only）

Base：`/superadmin/mail/*`  
权限：`api:superadmin:read|write` + `assertSuper(SUPER_ADMIN)`

| Method | Path | 说明 |
|--------|------|------|
| GET | `/status` | SMTP 公开视图 + 策略 + runtime 开关 |
| GET/POST | `/smtp` | 读/写 SMTP；密码永不回显明文，仅 `********` |
| GET/POST | `/code-policy` | 验证码策略 |
| GET/POST | `/templates` | 列表 / upsert |
| GET | `/logs` | 发送日志 |
| POST | `/test-connection` | SMTP verify |
| POST | `/test-send` | 测试发送 |

前端入口：`/superadmin/mail`（仅 `SUPER_ADMIN` 可见）

---

## 5. Security

- SMTP Password：`MAIL_CONFIG_CRYPTO_KEY` + AES-256-GCM 存储  
- API / Super Admin UI：永不返回明文密码；前端固定显示 `********`  
- 生产：无 `devCode`、无验证码明文日志  
- 邮件日志：收件人脱敏；错误信息经 `sanitizeErrorMessage`  
- 配置 / 测试 / 日志查看：仅 SUPER_ADMIN  

---

## 6. Auth wiring

- `V12AuthService.sendCode`（email）：限流 → `ensureDeliveryMode` → 落库 hash → 模板发送  
  - SMTP 可用 → 真实发送，响应无 code  
  - 非生产 + `MAIL_DEV_CODE_ENABLED=true` → log + `devCode`  
  - 否则 → `ServiceUnavailableException('邮件服务尚未配置')`  
- `forgotPassword`：模板发送 + `softFail` 防枚举；生产不返回 `devToken`、不打明文 token 日志  

---

## 7. Verification performed

| Check | Result |
|-------|--------|
| `prisma generate` | PASS |
| `backend` `npm run typecheck` | PASS |
| `backend` `npm run build` | PASS |
| `frontend` `tsc` + `vite build` | PASS |
| `node scripts/mail-center-smoke.mjs`（策略矩阵 + AES） | PASS |
| `prisma migrate deploy` / `seed`（本地） | **待执行**：工作区无 backend `.env`；需在 test 栈对 DB 执行 |
| 真实 SMTP / 权限联调 | **待赵总在 test 环境验收时执行** |

推荐 test 栈命令（不碰 Production）：

```bash
# 在 test 环境 env 中设置：
# MAIL_CONFIG_CRYPTO_KEY=...
# MAIL_DEV_CODE_ENABLED=false   # 或 true 仅用于联调

cd backend
npx prisma migrate deploy
npm run seed
```

权限测试清单：
1. SUPER_ADMIN 可访问 `/superadmin/mail` 与全部 mail API  
2. ADMIN / USER → 403 / 前端重定向  
3. SMTP 未配置 + Production → sendCode 返回「邮件服务尚未配置」，无 `devCode`  
4. SMTP 未配置 + Dev + `MAIL_DEV_CODE_ENABLED=false` → 同样错误  
5. SMTP 未配置 + Dev + `MAIL_DEV_CODE_ENABLED=true` → 可 `devCode`，日志可含 code（仅非生产）  
6. 保存密码后 GET SMTP 仅见 `********`  

---

## 8. Rollback

见 `docs/ZRH-AI-Mail-Center-V1.0-Rollback-Plan.md`。  
概要：回退本分支提交；DB 可保留表（只读无害）或按回滚脚本 drop `mail_*`；`sendCode` 恢复为旧行为需代码回滚。

---

## 9. Production gate

**禁止**在赵总书面验收前部署 Production。  
验收通过后再单独申请生产 migration + web/api 发布窗口。

---

## 10. Files touched (summary)

- `backend/prisma/schema.prisma` + migration + `seed.js`  
- `backend/src/mail/**`  
- `backend/src/auth/v12-auth.service.ts` / `auth.module.ts`  
- `backend/src/app.module.ts` / `superadmin/*`  
- `frontend/src/pages/MailCenterView.tsx` / `SuperAdminPage.tsx` / `api/v12.ts` / i18n  
- `.env*.example`  
- `backend/scripts/mail-center-smoke.mjs`  
- 本报告  

---

## 11. Git commit note

当前工作区除 Mail Center 外，尚有大量未提交的 V1.2 变更（Developer / RAG / Knowledge 等）。  
为避免误打包无关 diff，**本轮尚未自动 git commit**。  
请赵总确认后，再单独提交 Mail Center 相关文件（或指示按文件清单提交）。

**Verdict:** Mail Center V1.0 **code complete on `test/v1.2`**；本地 typecheck/build/smoke PASS；**DB migrate/seed 与 SMTP/权限实机测试待 test 环境执行**；**等待赵总验收后再决定生产部署与 git commit。**
