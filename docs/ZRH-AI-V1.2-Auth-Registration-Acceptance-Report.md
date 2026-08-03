# ZRH AI V1.2 注册与登录专项验收报告

**Date:** 2026-08-02  
**Branch:** `test/v1.2`  
**Workspace HEAD:** `a25d1e2535f428561ad442455288af660325710c`  
**Approver:** 赵总（待批）  
**约束：** 未修改 / 未重启 V1.1 Production

---

## 1. 公网生产（V1.1）核对 — 只读

| 项 | 结果 |
|----|------|
| URL | https://ai.zrhtech.com |
| 本地绑定 | Web `3010` · API `4010`（容器 `zrh-ai-web` / `zrh-ai-api`） |
| Health `version` | **`0.1.0`**（`https://ai.zrhtech.com` 与 `127.0.0.1:4010` 一致） |
| Docker 镜像 | `zrh-ai-api:0.1.0` · `zrh-ai-web:0.1.0` |
| 容器创建时间 | 2026-07-31（未在本轮重启） |
| 产品冻结 Git | Tag **`v1.1.0`** → 提交 **`5244b4f6e26d8a607367205d558dc867ea13d27d`**（与《v1.1 Production Deployment Final Report》一致） |
| `main` 最新文档提交 | `2888b598`（release report）；**V1.2 不在 main** |

### 生产登录页 UI（实测截图/快照）

| 元素 | 生产 V1.1 |
|------|-----------|
| 标题 | **管理员登录** |
| 注册入口 | **无** |
| 忘记密码 | **无** |
| Remember Me | **无** |
| 三语言切换 | 有（中文 / 缅文 / English） |

**结论：** 公网当前为 **V1.1**；无用户注册入口属预期，不是故障。

---

## 2. V1.2 代码位置 — 未部署生产

| 项 | 结果 |
|----|------|
| 分支 | `test/v1.2` |
| 注册 API | `POST /api/v1/auth/register`（`v12-auth.service.ts`） |
| 前端注册页 | `/register` + 登录页链接「注册 / 忘记密码」 |
| 是否 merge `main` | **否** |
| 是否部署公网 | **否**（公网仍 `*:0.1.0` / 管理员登录） |

---

## 3. 独立测试环境 `zrh-ai-test` — 已启动

| 项 | 配置 |
|----|------|
| Compose 项目 | **`zrh-ai-test`**（`-p zrh-ai-test` + `docker-compose.test.yml`） |
| Web | **`127.0.0.1:3011`** → `zrh-ai-web:1.2.0-test` |
| API | **`127.0.0.1:4011`** → `zrh-ai-api:1.2.0-test` |
| PostgreSQL | 独立卷 `zrh-ai-test-postgres-data`（DB `zrh_ai_test`，**未映射到生产 5440**） |
| Redis | 独立卷 `zrh-ai-test-redis-data`（**未映射到生产 6380**） |
| Dev Runner | `zrh-ai-test-dev-runner`（内部网） |
| Env | 本地 `.env.test`（已加入 `.gitignore`） |

### 生产隔离确认

| 检查 | 结果 |
|------|------|
| 生产容器仍 Up | `zrh-ai-web` / `zrh-ai-api` **Up 9h+ healthy**，端口仍 3010/4010 |
| 公网 health | 仍 `version: 0.1.0`，200 |
| 测试端口冲突 | 无（3011/4011 仅 loopback） |

> 说明：API `package.json` 版本字段仍为 `0.1.0`，故 **test health JSON 的 `version` 也显示 `0.1.0`**。区分依据是 **镜像标签 `1.2.0-test` + 功能面（注册/登录中心）**，非 package version 字段。

---

## 4. 功能验收（仅在 3011/4011）

| # | 功能 | 结果 | 证据 |
|---|------|------|------|
| 1 | 用户名注册 | **Pass** | `POST /auth/register` → `USER` + tokens |
| 2 | 邮箱注册 | **Pass** | send-code → 日志取码 → register 成功 |
| 3 | 手机号注册 | **Pass（预留通道）** | 无 SMS；无 `phoneCode` 可注册；UI 标注「手机号 (预留)」 |
| 4 | 登录 | **Pass** | username + password → access/refresh |
| 5 | 忘记密码 | **Pass（签发）** | forgot-password 200；API 日志签发 reset-token；`reset-password` 路由已映射（本轮未再跑完整改密重登，避免凭据二次操作） |
| 6 | Remember Me | **Pass（UI+API）** | 登录页复选框；`rememberMe:true` 登录成功（refresh 长会话） |
| 7 | 用户中心 | **Pass** | `GET /user-center/me` 返回 profile |
| 8 | Admin | **Pass** | SUPER_ADMIN → `/admin/dashboard` 200 |
| 9 | Super Admin | **Pass** | `/superadmin/overview` 200 |
| 10 | RBAC | **Pass** | 普通 USER 访问 `/admin/dashboard` → **HTTP 403** |
| 11 | 中文 / 缅文 / 英文 | **Pass（键齐全）** | zh/en/my 均有 loginTitle / register / forgotPassword / rememberMe |

### 测试登录页 UI（http://127.0.0.1:3011/login）

| 元素 | V1.2 Test |
|------|-----------|
| 标题 | **登录中心**（非「管理员登录」） |
| 注册 | **有** → `/register` |
| 忘记密码 | **有** → `/forgot-password` |
| Remember Me | **有** |
| 三语言 | **有** |

注册页可见：用户名 / 邮箱+验证码 / 手机号(预留) / 协议勾选。

---

## 5. 已知限制（验收备注）

1. **邮件验证码 / 重置令牌**：测试环境 `NODE_ENV=production`，`devCode` 不回传；码在 **API 容器日志**（SMTP 未接）。  
2. **手机短信**：明确 reserved，非完整运营商短信验收。  
3. **Health version 字段**：未随 `1.2.0-test` 镜像标签升版（建议后续仅改 version 字符串，属 polish）。  
4. 测试栈镜像含本机工作区构建产物（含品牌图标与编译修复），**不得**直接推上公网。

---

## 6. 裁决

| 项 | 结论 |
|----|------|
| 公网无注册入口原因 | **V1.1 生产正常行为** |
| V1.2 注册/登录 | **独立测试栈验收通过（带预留通道备注）** |
| 可否发布生产 | **No-Go — 等待赵总批准** |
| 生产是否被改动 | **否** |

---

## 7. 请赵总审批

- [ ] 确认公网继续运行 V1.1，注册入口缺失为预期  
- [ ] 确认 V1.2 注册/登录可在 `3011/4011` 继续联调  
- [ ] **批准 / 不批准** 将 V1.2 Auth 发布到生产（本报告不自动发布）  

**签字：** _______________　日期：________

---

## 附录：访问方式

```text
# V1.1 Production（勿改）
https://ai.zrhtech.com          # → 3010/4010

# V1.2 Test（本机）
http://127.0.0.1:3011/login
http://127.0.0.1:4011/api/v1/health

# 启停（不影响生产）
docker compose -p zrh-ai-test -f docker-compose.test.yml --env-file .env.test up -d
docker compose -p zrh-ai-test -f docker-compose.test.yml --env-file .env.test down
```
