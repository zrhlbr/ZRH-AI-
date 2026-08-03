# ZRH AI Enterprise V1.2 Production Deployment Report

**Status:** **Deployed — Smoke PASS（含 i18n 复核）**  
**Date:** 2026-08-02  
**Strategy:** Blue-Green / 可回滚  
**Public URL:** https://ai.zrhtech.com  
**Origin:** `zrh-server` (`192.168.10.74`) · `/home/zrh-admin/zrh-ai`  
**Approver gate:** 未经赵总确认，**不得删除** V1.1 回滚资源  

---

## 1. 执行摘要

| 项 | 结果 |
|----|------|
| 完整备份（PG / Redis / .env / compose / Nginx / Images） | **Done** |
| Git tag `v1.1.0-final-backup` | **Created** → `5244b4f6e26d8a607367205d558dc867ea13d27d`（V1.1.0 freeze） |
| V1.1 镜像保留 | **Done**（`1.1.0` + `v1.1.0-final-backup`） |
| Frontend / Backend / Dev Runner / Migration | **Done** |
| 生产冒烟 | **PASS**（见 §6；i18n 初次探测假阴性，镜像内复核 PASS） |
| 阻断性问题 | **无** — 未触发回滚 |
| V1.1 回滚资源删除 | **未执行**（按令保留） |

---

## 2. 备份清单

**Backup path:** `/home/zrh-admin/zrh-ai/backups/v1.1.0-final-20260802-124316`  
**Symlink:** `backups/v1.1.0-final-latest` → 上述目录  
**Size:** ~151 MB  

| 类别 | 内容 |
|------|------|
| PostgreSQL | `db/zrh_ai.dump`（custom format）+ `db/schema.sql` |
| Redis | `redis/dump.rdb` |
| Env | `env/.env`（权限保留） |
| Compose | `compose/docker-compose.production.yml` 等 |
| Nginx | `nginx/`（deploy 模板 + sites-available 副本） |
| Docker Images | `images/zrh-ai-1.1.0-images.tar.gz` |
| Tree | `tree/zrh-ai-v1.1-tree.tar.gz` |
| Meta | `meta/inventory.txt` |

**Image aliases（快速回滚）：**

- `zrh-ai-api:1.1.0` / `zrh-ai-api:v1.1.0-final-backup`
- `zrh-ai-web:1.1.0` / `zrh-ai-web:v1.1.0-final-backup`

---

## 3. Git

| Tag | Target |
|-----|--------|
| `v1.1.0` | Production freeze `5244b4f…` |
| `v1.1.0-final-backup` | 同上（发布前备份锚点） |

> 说明：V1.2 以工作区同步至 origin 后构建；本地分支 `test/v1.2` 含大量未提交变更。部署元数据记录 `GIT_SHA=working-tree-v1.2`。建议赵总批准后另做正式 `v1.2.0` 提交/打 tag（本次未强制 push）。

---

## 4. 部署变更

| 组件 | 旧（Blue / V1.1） | 新（Green / V1.2） |
|------|-------------------|-------------------|
| `zrh-ai-web` | `zrh-ai-web:1.1.0` | `zrh-ai-web:1.2.0` |
| `zrh-ai-api` | `zrh-ai-api:1.1.0` | `zrh-ai-api:1.2.0` |
| `zrh-ai-dev-runner` | （无） | `zrh-ai-dev-runner:1.2.0` |
| Postgres / Redis | 原容器与卷 | **保留**（未重建数据卷） |
| Nginx upstream | `:3010` / `:4010` | **不变** |
| `ZRH_AI_IMAGE_TAG` | `1.1.0` | `1.2.0` |
| 新增 env | — | `DEV_RUNNER_TOKEN`、`CURSOR_CLOUD_ENABLED=false` |

**Compose：** 生产文件升级为含 Dev Runner + workspaces 卷的 V1.2 蓝绿模板。  
**Migration：** 容器入口 `prisma migrate deploy`（V1.2 用户中心 / Developer Agent / Knowledge indexes，增量）。

---

## 5. 运行时状态（Cutover 后）

| Container | Image | Status |
|-----------|-------|--------|
| `zrh-ai-web` | `zrh-ai-web:1.2.0` | healthy · `127.0.0.1:3010` |
| `zrh-ai-api` | `zrh-ai-api:1.2.0` | healthy · `127.0.0.1:4010` |
| `zrh-ai-dev-runner` | `zrh-ai-dev-runner:1.2.0` | healthy · internal `:5055` |
| `zrh-ai-postgres` | `postgres:16-alpine` | healthy |
| `zrh-ai-redis` | `redis:7-alpine` | healthy |

Health（origin）：`database=online` · `redis=online` · `ollama=online`  
Public：`https://ai.zrhtech.com` / `/api/v1/health` → **ok**

---

## 6. 生产冒烟结果

| # | Check | Result |
|---|-------|--------|
| 1 | Health | **PASS** |
| 2 | Login | **PASS** |
| 3 | Register（端点启用） | **PASS**（HTTP 400 空体校验，端点可达） |
| 4 | Chat（SSE） | **PASS** |
| 5 | Knowledge | **PASS** |
| 6 | Enterprise RAG | **PASS**（health + search） |
| 7 | Developer | **PASS** |
| 8 | Workflow | **PASS** |
| 9 | Agent | **PASS** |
| 10 | MCP | **PASS** |
| 11 | Admin | **PASS** |
| 12 | Super Admin | **PASS** |
| 13 | PWA（manifest / theme / brand icon） | **PASS** |
| 14 | 三语言（zh / en / my） | **PASS*** |
| 15 | Public HTTPS SPA | **PASS** |

\*初次脚本未命中 hashed chunk → 记 FAIL；随即在 `zrh-ai-web` 镜像内确认 `index-*.js` 含 `zh-CN` / `en-US` / `my-MM` → **复核 PASS**。

**汇总：** 无阻断 FAIL；**未回滚**。

---

## 7. 回滚手册（保留，勿删资源）

```bash
# On zrh-server
cd /home/zrh-admin/zrh-ai
BACKUP=backups/v1.1.0-final-latest

# 1) 停 Green 应用容器（保留数据卷）
docker compose -f docker-compose.production.yml --env-file .env stop zrh-ai-web zrh-ai-api zrh-ai-dev-runner

# 2) 恢复 V1.1 树与 compose（可选，若代码面需回退）
# tar -xzf $BACKUP/tree/zrh-ai-v1.1-tree.tar.gz -C /home/zrh-admin/zrh-ai

# 3) 切回镜像 tag
# 编辑 .env: ZRH_AI_IMAGE_TAG=1.1.0
# 若 compose 已含 runner，可用 V1.1 备份 compose：
cp $BACKUP/compose/docker-compose.production.yml ./docker-compose.production.yml
sed -i 's/^ZRH_AI_IMAGE_TAG=.*/ZRH_AI_IMAGE_TAG=1.1.0/' .env

docker compose -f docker-compose.production.yml --env-file .env up -d

# 4) 如 migration 需数据回退（仅紧急）：
# docker exec -i zrh-ai-postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < $BACKUP/db/zrh_ai.dump
```

**禁止：** 删除 `backups/v1.1.0-final-*`、`zrh-ai-*:1.1.0`、`zrh-ai-*:v1.1.0-final-backup`，除非赵总书面确认。

---

## 8. 风险与后续

| 风险 | 级别 | 说明 |
|------|------|------|
| 工作区未正式 commit / tag `v1.2.0` | Medium | 建议补正式发布提交与 tag |
| 历史质量门 No-Go（Freeze 评分） | Medium | 本次为赵总指令强制发布；持续监控 |
| Developer Runner 新依赖 | Low | 已健康；token 已写入 `.env` |
| Knowledge 语料可能仍稀疏 | Low | RAG 结构通路已通 |

**未做：** ZRHPay / Accounting / Router OS 任何升级。

---

## 9. 签字

- [ ] 赵总确认 V1.2 Production 发布验收  
- [ ] 赵总确认可保留 / 或另行批准清理 V1.1 回滚资源（默认：**保留**）  

**签字：** _______________　**日期：** ________
