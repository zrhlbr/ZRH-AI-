# ZRH AI Mail Center V1.0 Test Integration Report

**Branch:** `test/v1.2`  
**Pre-commit HEAD:** `214a12a`  
**Test stack project:** `zrh-ai-test`（`docker-compose.test.yml` + `.env.test`）  
**Date:** 2026-08-02  
**Production deploy:** **未执行（影响 = 0）**  

---

## 1. Migration 结果

| 项 | 结果 |
|----|------|
| Migration | `20260802170000_mail_center_v1` **Applied**（entrypoint） |
| `prisma migrate status` | **Database schema is up to date!**（14 migrations） |
| 目标库 | `zrh_ai_test` @ `zrh-ai-test-postgres`（独立卷） |

## 2. Seed 结果

| 项 | 结果 |
|----|------|
| 首次 seed（entrypoint） | `mail configs: 14, templates: 27` |
| 再执行 seed ×2 | 同为 `14` / `27` — **幂等，无重复污染** |

## 3. 新表与配置键

| 对象 | 结果 |
|------|------|
| `mail_templates` | 存在 |
| `mail_send_logs` | 存在 |
| `system_configs` `mail.*` | **14** 键（SMTP + code policy） |

## 4. SMTP 未配置测试（`MAIL_DEV_CODE_ENABLED=false`，`NODE_ENV=production`）

| 检查 | 结果 |
|------|------|
| 注册验证码 `send-code` | **503** + 「邮件服务尚未配置」 |
| 忘记密码 `forgot-password` | **503** + 「邮件服务尚未配置」 |
| 无 `devCode` / `devToken` | **PASS** |
| 不假装发送成功 | **PASS** |

## 5. DevCode 开关测试

| 状态 | 结果 |
|------|------|
| `MAIL_DEV_CODE_ENABLED=false` + SMTP 未配置 | 503「邮件服务尚未配置」，无 `devCode` |
| `MAIL_DEV_CODE_ENABLED=true` + SMTP 未配置 | **200**，`hasDevCode=true`（长度 6；正文未写入本报告） |
| 关闭开关后 | 立即恢复 503，无 `devCode` |

说明：test 栈 `NODE_ENV=production`；**以 `MAIL_DEV_CODE_ENABLED` 为显式开关**。真实 Production 必须保持 `false`（`.env.production.example` 已默认关闭）。

## 6. SMTP mock 测试

| 场景 | 结果 |
|------|------|
| 保存 mock SMTP（127.0.0.1:9） | PASS；API 密码 `********` |
| `********` 再保存不覆盖真实密文 | PASS（`passwordConfigured` 仍 true） |
| 连接测试失败 | PASS（400） |
| 测试发送失败 | PASS（503） |
| `mail_send_logs` 失败记录 | PASS；收件人脱敏 `p***@example.com`；无密码明文 |
| 认证失败 / TLS / 超时 / 无效收件人 | 覆盖为 mock 连接拒绝路径（真实 Provider 细分未跑） |
| 发送间隔 / 日上限 / TTL / 重试 | 策略 API 可读写；限流在未配置 SMTP 时以「尚未配置」优先 |

## 7. 真实 SMTP 测试

**未执行** — 赵总未提供真实 SMTP 凭据。候选资格不依赖真实外发。

## 8. 注册验证码结果

- SMTP 关 + 开关关 → 明确错误（见 §4）  
- SMTP 关 + 开关开 → 返回 `devCode`（见 §5）  
- 用户名注册路径未要求邮件 — 不受影响  

## 9. 忘记密码结果

- SMTP 未配置 → **503「邮件服务尚未配置」**（不再假装成功）  
- 无 `devToken`（开关关闭时）  

## 10. SUPER_ADMIN 权限结果

| 角色 | 结果 |
|------|------|
| SUPER_ADMIN | 可 status / smtp / templates / logs / test-* |
| 未登录 | **401** |
| ADMIN / USER / VIP / ENTERPRISE | 无独立测试账号；由 `assertSuper` + 权限码保证（与 Super Admin 其它页一致）。建议验收时补 ADMIN 账号 403 抽样。 |

## 11. 密钥加密与脱敏

| 检查 | 结果 |
|------|------|
| `MAIL_CONFIG_CRYPTO_KEY` 已注入 test API | PASS |
| API 返回密码 | 仅 `********` 或空 |
| 掩码再保存不清空 | PASS |
| 发送日志无密码 / Token / 验证码正文 | PASS（脱敏收件人 + sanitize error） |

## 12. 三语言结果

- `mailCenter.*`：**42 keys**，zh-CN / en-US / my-MM **一致**  
- Seed 模板：每类型 zh-CN / en-US / my-MM 共 27 条  

## 13. Build / Typecheck

| 检查 | 结果 |
|------|------|
| backend typecheck | PASS |
| backend build | PASS |
| frontend typecheck | PASS |
| frontend build | PASS（先前与本次联调镜像构建） |
| prisma validate（本地需 `DATABASE_URL`） | PASS（dummy URL） |
| prisma migrate status（test） | PASS |
| seed 幂等 | PASS |
| mail-center-smoke | PASS |
| mail-center-integration | **13/13 PASS** |
| mail-center-smtp-mock | **12/12 PASS** |

## 14. Docker test 栈状态

| 容器 | 状态 |
|------|------|
| `zrh-ai-test-postgres` | Healthy，独立卷 |
| `zrh-ai-test-redis` | Healthy，独立卷 |
| `zrh-ai-test-api` | Healthy，端口 `127.0.0.1:4011` |
| `zrh-ai-test-web` | Up，端口 `127.0.0.1:3011` |
| `zrh-ai-test-dev-runner` | Healthy |
| Production `zrh-ai-*` | **未改动** |

## 15. Commit SHA

- **Full:** `18af384c3edf8bcc38226dff1ca81a4b44153425`
- **Short:** `18af384`
- **Message:** `feat(mail): add enterprise mail center and verification delivery`
- **Parent (pre-mail):** `214a12a`

## 16. 提交文件清单（33）

仅白名单 Mail Center 文件（`git show --name-only 18af384`）：

```
.env.example
.env.production.example
.env.test.example
backend/package-lock.json
backend/package.json
backend/prisma/migrations/20260802170000_mail_center_v1/migration.sql
backend/prisma/schema.prisma
backend/prisma/seed.js
backend/scripts/mail-center-integration.mjs
backend/scripts/mail-center-smoke.mjs
backend/scripts/mail-center-smtp-mock.cjs
backend/src/app.module.ts
backend/src/auth/auth.module.ts
backend/src/auth/v12-auth.service.ts
backend/src/mail/dto/mail.dto.ts
backend/src/mail/mail-crypto.util.ts
backend/src/mail/mail.constants.ts
backend/src/mail/mail.controller.ts
backend/src/mail/mail.module.ts
backend/src/mail/mail.service.ts
backend/src/superadmin/superadmin.module.ts
backend/src/superadmin/superadmin.service.ts
docs/ZRH-AI-Mail-Center-V1.0-Change-Plan.md
docs/ZRH-AI-Mail-Center-V1.0-Impact-Analysis.md
docs/ZRH-AI-Mail-Center-V1.0-Implementation-Report.md
docs/ZRH-AI-Mail-Center-V1.0-Rollback-Plan.md
docs/ZRH-AI-Mail-Center-V1.0-Test-Integration-Report.md
frontend/src/api/v12.ts
frontend/src/i18n/locales/en-US.json
frontend/src/i18n/locales/my-MM.json
frontend/src/i18n/locales/zh-CN.json
frontend/src/pages/MailCenterView.tsx
frontend/src/pages/SuperAdminPage.tsx
```

隔离保证：提交用的 `schema.prisma` / `seed.js` / `app.module.ts` **不含** Developer Agent 模型/权限/`DeveloperModule`。

## 17. 其它未提交变更隔离证明

提交后工作区仍保留大量未提交变更（Chat/Knowledge/RAG/Developer/Workflow 等），**未进入 `18af384`**。  
`git status --short` 在提交后仍显示这些 `M`/`??` 文件保持原状（未 stash / 未 reset / 未 clean）。

## 18. Production 影响

**0** — 未部署、未改生产卷/compose/DB。

## 19. 遗留风险

1. 真实 SMTP 外发未验收  
2. ADMIN 非超管 403 需人工抽样（无 admin2 账号）  
3. my-MM 模板文案部分为简写占位，可后续润色  
4. test 栈与工作区仍含其它未提交 V1.2 代码；**本次提交严格白名单隔离**  
5. Production 若误开 `MAIL_DEV_CODE_ENABLED=true` 会泄露 `devCode` — 运维必须保持 false  

## 20. Production 候选资格

**有条件候选（Conditional）**  
代码与 test 栈联调通过；须赵总验收 + 真实 SMTP 窗口后再批准生产 migration/部署。

---

## Commit Evidence

| 项 | 值 |
|----|-----|
| SHA | `18af384c3edf8bcc38226dff1ca81a4b44153425` |
| Files | 33（见 §16） |
| Stat | +2765 / −22 |
| Isolation | schema/seed/app.module 已剥离 Dev；无关文件仍 dirty 未提交 |
