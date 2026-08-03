# ZRH AI Enterprise V1.2.1 Production Acceptance Report

**文档名称：** 《ZRH AI Enterprise V1.2.1 Production Acceptance Report》  
**版本：** Production `v1.2.1`  
**公网：** https://ai.zrhtech.com  
**验收日期：** 2026-08-02  
**验收范围：** Production Acceptance only（未新增功能 / 未改业务逻辑 / 未改数据库）  
**验收结论：** **条件通过（Conditional Pass）——等待赵总审批**  
**说明：** 第一轮 Android 真机 / 第二轮 iPhone 真机需赵总现场确认；本报告已完成 Windows 公网 + 生产 Origin API/PWA/Brand/性能验收。

---

## 0. 生产运行态（验收时点）

| 容器 | 镜像 | 状态 |
|------|------|------|
| `zrh-ai-web` | `zrh-ai-web:1.2.1` | Up · healthy |
| `zrh-ai-api` | `zrh-ai-api:1.2.1` | Up · healthy |
| `zrh-ai-dev-runner` | `zrh-ai-dev-runner:1.2.1` | Up · healthy |
| `zrh-ai-postgres` | `postgres:16-alpine` | Up · healthy |
| `zrh-ai-redis` | `redis:7-alpine` | Up · healthy |

---

## 1. 通过项

### 1.1 第一轮 — Android（能力层 / 可安装性）

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 注册入口 | **PASS** | `/register` HTTP 200；`POST /api/v1/auth/register` 空体 **400**（端点存活，非 404） |
| 登录入口 | **PASS** | `/login` HTTP 200；Origin `POST /auth/login` → token_ok |
| Chat | **PASS** | `GET /chat/list` 200；`POST /chat` SSE **PASS**（~9.5s，含 meta/rag/delta） |
| Knowledge | **PASS** | `GET /knowledge/status` 200；未登录 **401** |
| PWA 安装能力 | **PASS（配置层）** | `manifest.json` `display=standalone`；`theme_color/background_color=#ffffff`；`/sw.js?v=1.2.1` 200；Landing 含 Install CTA + `beforeinstallprompt` 引导 |
| Standalone | **PASS（配置层）** | manifest `display=standalone` · `start_url=/` · `scope=/` |
| 更新 / Release Notes | **PASS** | `/release-notes` 200；登录页可见 Release notes 入口 |
| 三语言 | **PASS（文案层）** | zh-CN / en-US / my-MM 均含 `landing` / `pwa` / `releaseNotes`；公网 Landing 可切至 English（Register now / Log in / Install） |
| Android 真机安装 + Standalone 实开 | **待赵总** | 本环境无 Android 真机；见 §2 / §6 |

### 1.2 第二轮 — iPhone（能力层）

| 检查项 | 结果 | 证据 |
|--------|------|------|
| Safari 可访问 | **PASS（公网）** | 首页 / 登录 / 注册 / release-notes / health 均为 200 |
| Add to Home Screen 引导 | **PASS（文案层）** | iOS Share → Add to Home Screen 三步说明（zh/en/my）已上线 |
| 登录 / Chat / Knowledge / PWA 配置 | **PASS（同源能力）** | 与 Android 共用同一生产栈 |
| iPhone 真机 Add to Home Screen 实装 | **待赵总** | 本环境无 iPhone；见 §2 / §6 |

### 1.3 第三轮 — Windows Chrome / Edge + 全部后台

| 检查项 | 结果 | 明细 |
|--------|------|------|
| 公网 SPA（Chrome 等价 curl / WebFetch） | **PASS** | `/` `/login` `/register` `/release-notes` 200 |
| Edge | **PASS（同源）** | 与 Chrome 同公网源；未发现 Edge 专属资源差异 |
| Login | **PASS** | Origin token_ok |
| Profile | **PASS** | 200 |
| Knowledge | **PASS** | 200 |
| RAG health | **PASS** | 200 |
| Chat list | **PASS** | 200 |
| Chat SSE | **PASS** | ~9491ms · events ok |
| RAG search | **PASS** | 本轮与上轮验收均有 hits/data 结构响应 |
| Agents | **PASS** | 200 |
| Workflows | **PASS** | 200 |
| MCP | **PASS** | 200 |
| Admin | **PASS** | 200 |
| SuperAdmin | **PASS** | 200 |
| Developer | **PASS** | 200 |
| Business | **PASS** | 200 |
| 未授权隔离 | **PASS** | Knowledge / RAG / ChatList 无 token → **401** |

### 1.4 第四轮 — Brand

| 检查项 | 结果 | 证据 |
|--------|------|------|
| Logo / Brand 名 | **PASS** | Landing / Login 显示 **ZRH AI** · ZRH Technology Group |
| 蓝白主题 | **PASS** | 默认主题 `blue-white`；PWA `theme_color=#ffffff` |
| 字体 / Design System | **PASS（代码与线上一致）** | Design System V2.0；`brand.appVersion=1.2.1` |
| Icon | **PASS** | `/brand/pwa-192.png` `/brand/pwa-512.png` `/brand/zrh-ai-icon.svg` 等 200；manifest icons 完整 |
| Dark Mode | **PASS（能力层）** | 主题注册含 `blue-white-dark`；存储键 `zrh-ai-theme-v2` |
| Dark Mode 登录后视觉截图 | **待补** | 本轮浏览器自动化不可用；见 §2 |

### 1.5 第五轮 — 性能（响应时间）

**公网 Edge（Windows → https://ai.zrhtech.com，n=5）**

| 指标 | avg | min | max |
|------|-----|-----|-----|
| 首页 `/` | **395 ms** | 271 ms | 769 ms |
| Health `/api/v1/health` | **309 ms** | 287 ms | 333 ms |

**公网抽样（n=3，验收时点）**

| 页面/资源 | avg |
|-----------|-----|
| `/` | ~346 ms |
| `/register` | ~307 ms |
| `/login` | ~517 ms |
| `/release-notes` | ~578 ms |
| `manifest.json` | ~284 ms |
| `sw.js?v=1.2.1` | ~303 ms（偶发冷缓存可到 ~2s） |

**生产 Origin（127.0.0.1，容器旁路）**

| 指标 | 样本 |
|------|------|
| 首页 SPA | 1.17–1.42 ms |
| Knowledge status | 91–99 ms |
| RAG health | 68–94 ms |
| Chat SSE（短 ping） | **~9.5 s**（含模型流式生成，正常） |

**判定：** 首页 / Knowledge / RAG 健康检查均在可接受范围；Chat 耗时由模型推理主导，流式事件完整。

---

## 2. 发现的问题

| # | 严重度 | 问题 | 说明 | 是否阻塞上线 |
|---|--------|------|------|--------------|
| A1 | **中** | Android / iPhone **真机** PWA 安装与 Standalone 实开未在本轮完成 | 配置层已通过；需赵总用真机点验 Install / Add to Home Screen / 桌面图标打开 | **是（验收闭环）** / 否（能力上线） |
| A2 | **低** | Dark Mode / 缅文 Landing **视觉截图**本轮未新采 | 浏览器 MCP 会话中不可用；缅文 i18n 键已存在；历史登录三语截图可参考 | 否 |
| A3 | **低** | 公网边缘偶发冷缓存偏慢 | 如 `sw.js` 单次 ~2s、首页 max ~769ms；热路径回落到 ~300ms | 否 |
| A4 | **信息** | Release Notes 已知：部分 splash 仍偏暗色 | V1.2.1 knownIssues 已披露；非本轮回归 | 否 |
| A5 | **信息** | 验收脚本 `accept-v121-prod.sh` 中 ChatList 路径曾误用 `/chat/conversations` | 正确路径为 `/chat/list`；**产品 API 正常**，属脚本问题 | 否 |
| A6 | **信息** | Chat SSE body 若带 `"stream":true` 会校验失败 | 正确请求仅 `{"message":"..."}`；前端/正确脚本已按此调用 | 否 |

**本轮未发现：** 业务逻辑回归、数据库异常、后台大面积 5xx、PWA 资源 404（Dockerfile `COPY public` 修复后保持 200）。

---

## 3. 截图与证据

### 3.1 本轮可引用截图（既有 Brand/i18n）

| 文件 | 内容 |
|------|------|
| `docs/polish-screenshots/00-login-zh.png` | 登录 · 中文 |
| `docs/polish-screenshots/01-login-en.png` | 登录 · English |
| `docs/polish-screenshots/02-login-my.png` | 登录 · မြန်မာ |
| `docs/polish-screenshots/03-login-my-mobile.png` | 登录 · 缅文移动宽度 |

### 3.2 本轮公网文案证据（WebFetch，2026-08-02）

**Landing（English 态摘录）：**
- Brand：`ZRH AI` / `ZRH Technology Group · Enterprise Private AI Platform`
- CTA：`Register now` · `Log in` · `Install ZRH AI`
- PWA 卡：`Add ZRH AI to your home screen and open it like an app.` · `Not now`

**Login：** Sign-in Center · 中文 / မြန်မာ / English · Release notes · © ZRH Technology Group

### 3.3 建议赵总补拍（真机闭环）

请赵总用真机补齐以下截图后批准确认：

1. **Android Chrome：** 安装 ZRH AI → 桌面图标 → Standalone 打开 → 登录 → Chat → Knowledge  
2. **iPhone Safari：** 分享 → 添加到主屏幕 → 独立打开 → 登录 → Chat → Knowledge  
3. **Windows：** Chrome + Edge 各一张工作台；Account 内切换 **蓝白 Dark** 一张  
4. 可选：Landing 缅文态一张  

存放建议：`docs/polish-screenshots/v1.2.1-acceptance/`

---

## 4. 建议

1. **赵总优先完成 Android + iPhone 真机 PWA 闭环**，通过后可将结论从「条件通过」升为「正式通过」。  
2. 生产边缘若出现旧 `sw.js` 404 缓存，继续使用 `/sw.js?v=1.2.1`（或后续版本号）破坏缓存；勿回退 Dockerfile `COPY public`。  
3. 验收脚本统一使用 `/chat/list`，Chat body 勿传 `stream` 字段（避免假失败）。  
4. 后续 UI-only 可处理 splash 偏暗（已知问题）；**不进入 V1.3 / 不改业务 / 不改库**。  
5. V1.1 回滚镜像与备份继续保留，直至赵总书面批准清理。

---

## 5. 验收矩阵总览

| 轮次 | 范围 | 结果 |
|------|------|------|
| 1 | Android：注册 / 登录 / Chat / Knowledge / PWA / Standalone / 更新 / 三语言 | **配置+API 通过；真机待赵总** |
| 2 | iPhone：Safari / A2HS / 登录 / Chat / Knowledge / PWA | **配置+API 通过；真机待赵总** |
| 3 | Windows Chrome / Edge + 全部后台 | **通过** |
| 4 | Brand：Logo / 蓝白 / 字体 / Icon / Brand / Dark Mode | **通过（Dark 视觉截图待补）** |
| 5 | 性能：首页 / Chat / Knowledge / RAG | **通过** |

---

## 6. 审批

| 项 | 内容 |
|----|------|
| 验收执行 | AI Coding Agent（只读验收，无功能开发） |
| 约束遵守 | 未新增功能 · 未改业务逻辑 · 未改数据库 |
| 建议决策 | **条件通过**，待赵总真机确认后签署正式通过 |
| 审批人 | **赵总** |
| 审批状态 | **等待赵总审批** |

---

*End of Report — ZRH AI Enterprise V1.2.1 Production Acceptance*
