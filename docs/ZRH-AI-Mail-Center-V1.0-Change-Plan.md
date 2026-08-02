# 《修改计划》ZRH AI Enterprise Mail Center V1.0

**状态：** ⏳ **等待赵总批准后执行**  
**分支目标：** `test/v1.2`（**禁止 Production 部署**）  
**日期：** 2026-08-02  

---

## 0. 现有代码结论（已分析）

| 现状 | 说明 |
|------|------|
| 邮件验证码 | `v12-auth.service.ts` `sendCode`：生成 6 位码 → 写入 `verification_codes` → **仅打日志**，无真实 SMTP |
| SMTP / .env | 仓库内 **无** 现成 nodemailer/Mail 模块；Super Admin 集成页 `smtp: { reserved: true }` |
| 系统配置 | 已有 `SystemConfig`（`system_configs`），`group` 注释含 `smtp` |
| Super Admin UI | `SuperAdminPage`：overview / configs / ops / integrations / logs；**无 Mail Center** |
| 前端发码 | Register / ForgotPassword 已调 `v12Api.sendCode` / `forgotPassword` |

**结论：** 优先复用 `SystemConfig` + Super Admin 权限骨架；新增 Mail 服务模块，**最小接线**到现有验证码发送路径。不得重做注册/登录/忘记密码业务流程。

---

## 1. 目标（本阶段）

Super Admin → 系统设置 → **邮件中心（Mail Center）** 可视化管理 SMTP、模板、验证码策略、测试发送、状态监控；配置落库；密码 AES 加密；运行时优先读库，空库则首次从 `.env` 导入。

---

## 2. 允许 / 禁止

| 允许 | 禁止 |
|------|------|
| 新增 Mail Center 模块（后端 service/controller + 前端页面） | 改 Chat / Knowledge / RAG / Workflow / Agent / MCP / Business / Developer |
| 复用 `system_configs`（group=`smtp`/`mail`） | 改用户业务数据、业务逻辑 |
| 可选：新增 **邮件专用表**（模板/发送日志）——见影响分析，需批准 | 改 Database **业务结构**（用户/会话/知识等） |
| Auth **仅接线** `sendCode`/`forgotPassword` 调用 MailService | 改 Auth 登录/注册/权限模型 |
| 三语 i18n keys（mailCenter.*） | Production 部署 |
| Super Admin 菜单新增一项 | Admin 角色获得邮件中心权限 |

---

## 3. 架构方案（推荐）

```
SuperAdmin UI (/superadmin/mail-center)
        ↓
SuperAdmin / Mail APIs (SUPER_ADMIN only)
        ↓
MailCenterService
  ├─ SmtpConfigStore  (system_configs, AES for password)
  ├─ MailTemplateStore
  ├─ MailSender (nodemailer)
  ├─ MailMetrics / MailSendLog
  └─ bootstrapFromEnv() once if empty
        ↑
V12AuthService.sendCode / forgotPassword  → MailCenterService.sendTemplate(...)
```

### 3.1 配置存储（优先复用，少造表）

`system_configs` keys（示例）：

| key | group | secret |
|-----|-------|--------|
| `mail.smtp.host` | smtp | false |
| `mail.smtp.port` | smtp | false |
| `mail.smtp.username` | smtp | false |
| `mail.smtp.password` | smtp | **true**（AES 密文） |
| `mail.smtp.encryption` | smtp | false · `none\|ssl\|tls\|starttls` |
| `mail.smtp.fromEmail` / `fromName` / `replyTo` | smtp | false |
| `mail.smtp.connectionTimeoutMs` | smtp | false |
| `mail.code.length` / `ttlSeconds` / `intervalSeconds` / `dailyLimit` / `maxRetries` | mail | false |
| `mail.metrics.*` 或单独日志表统计 | mail | false |

### 3.2 模板存储（二选一，待赵总定）

**方案 A（推荐，少 schema）：** 模板 JSON 存 `system_configs`（`mail.template.register_code` 等）。  
**方案 B：** 新表 `mail_templates` + `mail_send_logs`（更清晰，属新增表，需明确批准）。

默认计划采用 **方案 A**；若赵总要求可审计发送日志，则采用 **方案 B**。

### 3.3 安全

- SMTP Password：AES-256-GCM，密钥来自 env `MAIL_CONFIG_CRYPTO_KEY`（或复用现有 secrets 约定）；API **永不返回明文**，前端固定 `********`；更新时若提交占位符则保留原密文。
- 接口：`SUPER_ADMIN` + 既有 `api:superadmin:read|write`；Admin 403。

### 3.4 前端页面（Design System V2.0）

路径：`/superadmin/mail-center`  
分区：SMTP 表单 · 验证码策略 · 模板编辑 · 测试发送 · 状态监控  
响应式：PC / Pad / Phone / PWA。

### 3.5 三语言

`zh-CN` / `en-US` / `my-MM` 同步新增 `mailCenter.*`（及菜单项），无缺失 key。

### 3.6 Auth 接线（最小）

仅改 `sendCode`（及忘记密码发码路径）：成功生成码后调用 MailCenter 发模板邮件；失败返回明确错误；**不改**注册/登录校验逻辑、不改 DTO 契约（除必要错误信息）。

### 3.7 依赖

允许新增后端依赖：`nodemailer`（+ `@types/nodemailer`）。禁止无关升级。

---

## 4. 实施步骤（批准后）

1. 后端 MailCenter 模块 + AES 工具 + env 导入  
2. SuperAdmin API：get/save SMTP、templates、code policy、test-send、status  
3. 接线 `v12-auth` 发码  
4. 前端 Mail Center 页 + 菜单 + i18n  
5. test 环境验证（注册码 / 忘记密码 / 测试发送）  
6. 输出《Implementation Report》+ Git commit  
7. **停止** — 等赵总 UAT / 审批后再谈 Production  

---

## 5. 验收清单（test）

- [ ] SUPER_ADMIN 可打开邮件中心  
- [ ] ADMIN 无法访问  
- [ ] SMTP 保存后密码前端为 `********`，API 无明文  
- [ ] 测试发送成功/失败与错误原因可见  
- [ ] 注册验证码真实发信（配置正确时）  
- [ ] 忘记密码发码真实发信  
- [ ] 模板可编辑并生效  
- [ ] 中/英/缅文案齐全  
- [ ] 未改 Chat/Knowledge/… 业务模块  

---

**批准口令（请赵总回复其一）：**

1. `批准 Mail Center V1.0 按方案 A 执行`（模板进 system_configs）  
2. `批准 Mail Center V1.0 按方案 B 执行`（新增 mail_templates + mail_send_logs）  
3. `驳回 / 修改计划：……`

**未经批准：不修改任何代码。**
