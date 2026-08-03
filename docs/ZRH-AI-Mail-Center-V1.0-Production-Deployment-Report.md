# ZRH AI Mail Center V1.0 Production Deployment Report

**公网：** https://ai.zrhtech.com  
**版本目标：** ZRH AI Enterprise **V1.2.2**（Mail Center）  
**部署日期：** 2026-08-02  
**状态：** ⚠️ **代码/迁移已上线；SMTP 真发与完整回归待新 Production App Password**  

---

## 0. 执行前门禁（Git）

| 项 | 值 |
|----|-----|
| 本地分支 | `test/v1.2` |
| 本地 HEAD（部署前） | `ec8e79d` |
| Mail Center 功能提交 | `18af384` |
| Mail Center 报告提交 | `ec8e79d` |
| 部署策略 | 自 `18af384` 抽取 Mail 文件，**外科叠加**到生产树；`app.module` **保留 DeveloperModule** 并新增 MailModule |
| 工作区其它 ~120 项未提交变更 | **未混入** |

---

## 1. 部署时间与镜像

| 项 | 值 |
|----|-----|
| 备份完成 | `2026-08-02T16:34:29+06:30` |
| API/Web 上线 | ~`2026-08-02T10:07Z`（UTC） |
| 镜像 | `zrh-ai-api:1.2.2` / `zrh-ai-web:1.2.2` |
| 回滚镜像标签 | `zrh-ai-api:1.2.1-pre-mail-center-v1` / `zrh-ai-web:1.2.1-pre-mail-center-v1` |
| 数据卷 | **未重建** |

---

## 2. 备份路径

`/home/zrh-admin/zrh-ai/backups/mail-center-v1-pre-20260802-163413`  
软链：`backups/mail-center-v1-pre-latest`  

含：PostgreSQL dump、schema、.env、compose、nginx（尽力）、镜像 tar（162M）、源码树、`ROLLBACK.md`。  
（users/verification CSV 因 PG 标识符大小写未导出成功；**主 dump `zrh_ai.dump` 完整可用**。）

### 回滚入口（摘要）

```bash
cd /home/zrh-admin/zrh-ai
docker tag zrh-ai-api:1.2.1-pre-mail-center-v1 zrh-ai-api:1.2.1
docker tag zrh-ai-web:1.2.1-pre-mail-center-v1 zrh-ai-web:1.2.1
# 恢复 .env 如需：cp backups/mail-center-v1-pre-20260802-163413/env/.env .env
docker compose -f docker-compose.production.yml --env-file .env up -d --no-deps zrh-ai-api zrh-ai-web
```

详见备份内 `meta/ROLLBACK.md`。

---

## 3. Migration / Seed

| 项 | 结果 |
|----|------|
| Migration | `20260802170000_mail_center_v1` **Applied** |
| migrate status | **up to date**（14 migrations） |
| `mail_templates` / `mail_send_logs` | **存在** |
| `system_configs` mail.* | **14** 键 |
| 默认模板 | **27** |
| seed 再执行 | 仍为 14 / 27 — **幂等** |
| `MAIL_DEV_CODE_ENABLED` | **false**（容器已确认） |

---

## 4. 已完成的安全/行为抽检（SMTP 未配置）

| 检查 | 结果 |
|------|------|
| API health | 200 · db/redis/ollama online |
| Web /login | 200 |
| `send-code` | **503「邮件服务尚未配置」** |
| 响应无 `devCode` | **PASS** |
| 未登录 Mail Center API | **401** |
| Knowledge/RAG 未登录 | 401（端点存活） |

---

## 5. SMTP 真发 — **暂停（安全门禁）**

按部署规范第 2 节，测试用 Gmail App Password **不得**作为生产长期密钥。

**当前未向 Production 写入任何 SMTP Password。**

待赵总提供并确认后继续：

1. 已在 Google 删除测试 App Password：□  
2. 新 Production App Password（仅私信/安全通道提供，不入 Git/文档/日志）：□  
3. From Email / Username 确认（是否仍为同一 Gmail）：□  

收到后立即执行：SMTP 保存（AES）→ verify → 中/缅/英测试邮件 → 注册码 → 忘记密码/重置 → 权限 403 → 完整回归 → 本报告终稿标记 **Production Ready**。

---

## 6. Production 影响（截至当前）

| 范围 | 影响 |
|------|------|
| API/Web 镜像 | 已升至 1.2.2（含 Mail Center UI/API） |
| DB | 新增 mail 表 + 配置键/模板；业务表未改结构 |
| Chat/Knowledge/RAG/Developer/… | 代码未改业务逻辑；DeveloperModule 保留 |
| Cloudflare / Nginx / PWA / 品牌 | 未改 |
| SMTP 外发 | **尚未启用**（未配置） |

---

## 7. 正式 Production Ready

**尚未标记** — 等待新密钥联调与完整回归通过后，由赵总确认。

---

*本报告为部署中途状态文档；SMTP 完成后将更新 §5–§20 终检项。*
