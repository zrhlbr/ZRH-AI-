# 《影响分析》ZRH AI Enterprise Mail Center V1.0

**状态：** ⏳ 等待赵总批准  
**关联：** `docs/ZRH-AI-Mail-Center-V1.0-Change-Plan.md`

---

## 1. 影响模块矩阵

| 模块 | 影响 | 说明 |
|------|------|------|
| Super Admin | **有（预期）** | 新增菜单/页面/API |
| Auth（V12 发码） | **最小接线** | `sendCode` / 忘记密码发码改为真实 SMTP；登录/注册校验逻辑不变 |
| SystemConfig | **有（预期）** | 写入 `group=smtp|mail` 配置 |
| Chat / Knowledge / RAG / Workflow / Agent / MCP / Business / Developer | **无** | 不触碰 |
| Admin（非 Super） | **无功能获得** | 应继续 403 |
| 前端 Design System | **复用** | 不改主题 token |
| 品牌 / PWA / Logo | **无** | 不触碰 |
| Production | **本阶段无部署** | 仅 test/v1.2 开发 |

---

## 2. 数据与兼容性

| 项 | 影响 |
|----|------|
| 用户表 / 业务表 | **不改** |
| `verification_codes` | 继续使用；TTL/长度可读 Mail 配置覆盖硬编码常量 |
| 现有注册/忘记密码 API 契约 | **保持兼容**；生产成功发信后不再依赖 `devCode` |
| 空库首次启动 | 从 `.env`（若存在 `SMTP_*`/`MAIL_*`）导入；无 env 则后台手工配置 |
| 旧行为（只打日志） | 配置缺失时：可降级为「配置未就绪」错误或保留 log-only（建议：**明确报错**，避免用户以为已发信）——待赵总确认降级策略 |

**建议默认降级策略（需批准）：**  
SMTP 未配置时，`sendCode` 返回 `503/400` + 三语文案「邮件服务未配置」，**不再伪造成功**（避免体验误导）。若需兼容旧联调，仅 `NODE_ENV!==production` 且未配置时保留 log + `devCode`。

---

## 3. 安全影响

| 风险 | 缓解 |
|------|------|
| SMTP 密码泄露 | AES 存库；API 脱敏；前端永不展示明文 |
| 越权 | SUPER_ADMIN + 现有权限码；Controller 双重校验 |
| 邮件轰炸 | 发送间隔 / 每日上限 / 失败重试配置 |
| 密钥缺失 | `MAIL_CONFIG_CRYPTO_KEY` 未设时禁止保存密码并告警 |

---

## 4. 性能与运维

| 项 | 说明 |
|----|------|
| 发信 | 同步短超时（connectionTimeout）；测试发送同步返回结果 |
| 监控 | 成功/失败计数 + 最后错误；方案 B 可落 `mail_send_logs` |
| Docker | 仅影响 api（+web）镜像构建；本阶段不上生产 |

---

## 5. 三语言 / 多端

| 端 | 影响 |
|----|------|
| PC / Pad / Phone / PWA | Super Admin 页响应式；无新原生壳 |
| zh / en / my | 新增 i18n，同步提交 |

---

## 6. 风险清单（发现即停）

| 风险 | 处理 |
|------|------|
| Auth 接线范围扩大导致登录回归 | **停止**，缩小 diff，汇报赵总 |
| 需改权限种子/角色模型 | **停止**，先批 |
| Production 误部署 | 流程禁止；compose 不自动推生产 |
| AES 密钥轮换 | 本阶段不做；后续另开任务 |

---

## 7. Production 影响（本阶段）

**无。** 本阶段仅 `test/v1.2` 实现与自测。上线需另开《生产发布计划》经赵总批准。
