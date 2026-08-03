# ZRH AI Mail Center — Production Readiness Report

**Module:** Mail Center V1.0  
**Phase:** SMTP Production Readiness（真实 SMTP 联调，无新功能开发）  
**Environment:** `zrh-ai-test` only（`127.0.0.1:4011`）  
**Date:** 2026-08-02  
**Code base:** `test/v1.2` @ `18af384` / report follow-up `ec8e79d`  
**Production deploy:** **未执行 — 等待赵总最终批准**  

---

## 1. Verdict

| 项 | 结论 |
|----|------|
| 真实 SMTP 联调 | **PASS** |
| Production 候选 | **有条件通过（Conditional Go）** |
| 是否可立即部署 Production | **否 — 须赵总最终书面批准** |

---

## 2. SMTP 配置（脱敏）

| 项 | 值（报告内不出现密码） |
|----|------------------------|
| Host | `smtp.gmail.com` |
| Port | `587` |
| Encryption | `starttls` |
| Username | `z***@gmail.com`（与 From 相同） |
| Password | **已加密写入 test `system_configs`；API 回显 `********`** |
| From Email | `z***@gmail.com` |
| From Name | `ZRH AI` |
| Timeout | `20000` ms |
| 配置落库 | test 栈 `mail.smtp.*` |

> 密码明文仅用于本次 test 联调输入，**未写入本报告、未提交 Git**。本地临时文件目录 `_mail_isolation/` 已加入 `.gitignore`。

---

## 3. 真实发送结果

| 场景 | 结果 | 延迟（约） | Message-ID |
|------|------|------------|------------|
| SMTP `verify` | PASS | ~1.9 s | n/a |
| 测试邮件 zh-CN（`system_notice`） | **sent** | ~3.7 s | 有 |
| 测试邮件 en-US | **sent** | ~2.8 s | 有 |
| 测试邮件 my-MM | **sent** | ~3.7 s | 有 |
| 注册验证码 `register_code` | **sent** | ~3.7 s | 有 |
| 忘记密码 `forgot_password` | **sent** | ~3.6 s | 有 |
| `MAIL_DEV_CODE_ENABLED` | `false` | — | 响应无 `devCode` |

自动化套件：`smtp_real_ready.cjs` → **15/15 PASS**。

收件箱：请赵总在 `z***@gmail.com` 确认上述邮件（含中/英/缅模板与验证码/重置邮件）。

---

## 4. 模板 / 日志 / Message-ID

| 检查 | 结果 |
|------|------|
| 模板库 zh-CN / en-US / my-MM | **27** 条齐全 |
| `mail_send_logs` | 真实发送记录 `status=sent`，`provider=smtp` |
| 收件人脱敏 | `z***@gmail.com` |
| Message-ID | 真实成功发送均有 |
| 日志无 SMTP 密码 / 验证码正文 / Token | **PASS** |
| API 密码字段 | 仅 `********` |

近期成功类型：`system_notice`, `register_code`, `forgot_password`。

---

## 5. Retry / Timeout / 失败路径

| 检查 | 结果 |
|------|------|
| `connectionTimeoutMs` | 20000（联调配置） |
| `mail.code.maxRetries` | 1（策略） |
| 历史 mock 失败日志 | `attempts` 达 2～4，`SMTP_SEND_FAILED`（先前 mock） |
| 故意错误 App Password → verify | **400**（认证失败可观测） |
| 恢复正确密码 → verify | **PASS** |

发送速度（Gmail）：单封约 **2.8–3.7 s**（含 TLS + 投递），可接受。

---

## 6. 安全与运维提醒

1. **Gmail App Password 已在对话中出现** — 建议联调结束后在 Google 账号轮换/作废该 App Password，并在 Production 使用新密钥。  
2. Production 必须：`MAIL_DEV_CODE_ENABLED=false`，配置强随机 `MAIL_CONFIG_CRYPTO_KEY`。  
3. 本次仅写入 **test** 库配置；**未改 Production 容器/卷/DB**。  
4. 部署 Production 前需单独 migration/seed（若生产尚未有 mail 表）与 SMTP 二次录入（勿复用聊天中的旧密码）。

---

## 7. Production 影响

**0**（本阶段）。

---

## 8. 遗留项

| 项 | 状态 |
|----|------|
| 赵总人工确认收件箱三语 + 验证码/重置邮件 | **待确认** |
| ADMIN 非超管 403 抽样 | 可选 |
| Production 部署窗口与回滚演练 | 待批准后另开 |

---

## 9. 批准门禁

- [ ] 赵总确认邮箱实收正常  
- [ ] 赵总最终批准 Production 部署  
- [ ] **未经批准：不得部署 Production**

---

**签署栏（赵总）**

| 结论 | 签名 / 日期 |
|------|-------------|
| □ 批准进入 Production 部署准备 | |
| □ 驳回 / 需补充 | |
