# ZRH AI Enterprise V1.2.1 Post-Release Improvement Report

**Status:** **Completed**  
**Date:** 2026-08-02  
**Public:** https://ai.zrhtech.com  
**Version:** `1.2.1`  
**Scope:** 上线后完善（Landing / PWA / Release Notes）  
**Constraints:** 未改业务逻辑 / DB / 权限模型；未进 V1.3 / Vision 2.0；**V1.1 回滚资源保留**

---

## 1. 任务完成情况

| 任务 | 结果 |
|------|------|
| 官网首页「立即注册 / 登录 / 安装 ZRH AI」 | **Done**（公开 `/` Landing） |
| 已登录跳转工作台 `/home` | **Done** |
| Android `beforeinstallprompt` | **Done** |
| iPhone「分享 → 添加到主屏幕」三语言说明 | **Done** |
| 7 天「稍后」不再强提醒；standalone 隐藏 | **Done** |
| `/release-notes` + 登录/用户中心/Footer 入口 | **Done** |
| 中 / 英 / 缅 i18n | **Done** |
| `tsc` / `npm run build` | **Pass** |
| Docker Web 健康 | **Pass**（`zrh-ai-web:1.2.1`） |

---

## 2. 修改文件（主要）

| 文件 | 说明 |
|------|------|
| `frontend/src/pages/LandingPage.tsx` | 公网落地页 CTA |
| `frontend/src/pages/ReleaseNotesPage.tsx` | 版本更新页 |
| `frontend/src/components/PwaInstallPrompt.tsx` | 安装引导 UI |
| `frontend/src/pwa/install.ts` | SW 注册 / dismiss / 设备检测 |
| `frontend/public/sw.js` | Service Worker |
| `frontend/public/manifest.json` | standalone / theme / icons |
| `frontend/Dockerfile` | **修复：** `COPY public`（此前镜像缺 brand/manifest/sw） |
| `frontend/nginx.conf` | `sw.js` no-cache |
| `frontend/src/main.tsx` | 公开路由 `/`、`/release-notes`；工作台 `/home` |
| `frontend/src/components/AppShell.tsx` | home→`/home`；Footer 版本更新 |
| `frontend/src/pages/LoginPage.tsx` / `AccountPage.tsx` | 版本更新入口 |
| `frontend/src/i18n/locales/{zh-CN,en-US,my-MM}.json` | landing/pwa/releaseNotes |
| `frontend/src/design-system/theme.ts` | `brand.appVersion = 1.2.1` |
| `VERSION` | `1.2.1` |

**未修改：** AI Gateway / Chat / RAG / Knowledge / Workflow / Agent / MCP / Business Hub / Prisma / 权限模型。

---

## 3. 路由行为

| 路径 | 访问 |
|------|------|
| `/` | 未登录：Landing（注册/登录/安装）；已登录 → `/home` |
| `/register` | 注册 |
| `/login` | 登录 → `/home` |
| `/home` | 原工作台（需登录） |
| `/release-notes` | 公开版本记录 |

---

## 4. PWA 检查

| 项 | 结果 |
|----|------|
| `manifest.json` | `display=standalone` · `scope=/` · `start_url=/` · `background_color=#ffffff` · `theme_color=#ffffff` |
| icons / Official Icon V1.0 | `/brand/*` · apple-touch-icon |
| service worker | `/sw.js`（origin **200**；注册 `/sw.js?v=1.2.1` 防 CF 旧 404 缓存） |
| Android install | `beforeinstallprompt` + 按钮 |
| iOS | Share → Add to Home Screen 三步说明（zh/en/my） |
| dismiss | `localStorage` 7 天 |
| standalone | 已安装不显示安装卡 |

> 说明：首次公网 `/sw.js` 曾被 Cloudflare 缓存为 404（修复 Dockerfile 前）；带 query 或 origin 直连均为 200。

---

## 5. 三语言

| Key 区 | zh-CN | en-US | my-MM |
|--------|:-----:|:-----:|:-----:|
| `landing.*` | ✅ | ✅ | ✅ |
| `pwa.*` | ✅ | ✅ | ✅ |
| `releaseNotes.*`（含 V1.1 / V1.2） | ✅ | ✅ | ✅ |

---

## 6. 公网冒烟

| Check | Result |
|-------|--------|
| `GET /` SPA | **200** |
| `GET /register` | **200** |
| `GET /release-notes` | **200** |
| `GET /manifest.json` | **200** JSON |
| `GET /brand/zrh-ai-icon.svg` | **200** |
| `GET /sw.js?v=1.2.1` | **200**（origin / CF with bust） |
| `GET /api/v1/health` | **ok**（业务未受影响） |

### 页面截图

本环境无浏览器自动化通道；请赵总在公网目视确认并可选截图归档：

1. https://ai.zrhtech.com — 「立即注册 / 登录 / 安装 ZRH AI」  
2. https://ai.zrhtech.com/register  
3. https://ai.zrhtech.com/release-notes  
4. 手机 Chrome 安装提示 / Safari 三步说明  

证据目录建议：`docs/polish-screenshots/v1.2.1/`（由验收方补图）。

---

## 7. Docker 状态（origin）

| Container | Image | Status |
|-----------|-------|--------|
| `zrh-ai-web` | `zrh-ai-web:1.2.1` | healthy |
| `zrh-ai-api` | `zrh-ai-api:1.2.1`（retag from 1.2.0） | healthy |
| `zrh-ai-dev-runner` | `zrh-ai-dev-runner:1.2.1`（retag） | healthy |
| postgres / redis | alpine | healthy |

**保留回滚：** `zrh-ai-*:1.1.0` · `v1.1.0-final-backup` · `backups/v1.1.0-final-latest`  
**另保留：** `zrh-ai-web:1.2.0` / `zrh-ai-api:1.2.0`

---

## 8. Git

| Item | Value |
|------|-------|
| Branch | `test/v1.2` |
| Tag（建议） | `v1.2.1` |
| Git SHA | 见提交后 `git rev-parse HEAD`（写入本报告定稿栏） |

---

## 9. 回滚方法（Web / V1.2.1）

```bash
cd /home/zrh-admin/zrh-ai
# 回退前端到 1.2.0（或 1.1.0）
sed -i 's/^ZRH_AI_IMAGE_TAG=.*/ZRH_AI_IMAGE_TAG=1.2.0/' .env
docker compose -f docker-compose.production.yml --env-file .env up -d zrh-ai-web
# 完整回 V1.1：见 V1.2 Production Deployment Report §7；勿删 backup
```

---

## 10. 签字

- [ ] 赵总确认 V1.2.1 上线后完善验收  
- [ ] V1.1 回滚资源继续保留  

**签字：** _______________　**日期：** ________
