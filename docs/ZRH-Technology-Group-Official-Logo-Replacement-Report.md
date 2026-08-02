# ZRH Technology Group Official Logo Replacement Report

**文档：** 《ZRH Technology Group Official Logo Replacement Report》  
**计划：** 《ZRH Technology Group 全系 LOGO 统一替换计划 V1.0》  
**产品：** ZRH AI Enterprise  
**日期：** 2026-08-02  
**分支：** `test/v1.2`  
**约束遵守：** 仅替换品牌资源与引用路径；**未改 Backend / API / DB / 业务逻辑 / 权限 / 路由 / 三语文案 / 主题色变量**

---

## 0. 修改前基线

| 项 | 值 |
|----|-----|
| 修改前 HEAD | `6e6d1f7a20094b02f2531cf78e51f6c8933e3b16` |
| 唯一官方母版 | `frontend/public/branding/zrh-logo-blue-white-master.png` |
| 母版规格（实测） | **1024 × 768**（约 4:3，JPEG 字节以 `.png` 名存放；派生输出为 PNG） |
| 派生全幅 PNG | `zrh-logo.png` → **1448 × 1086**（inside 缩放，无拉伸） |

> 扫描时仓库内**尚无**该母版路径；已将赵总聊天附件写入上述唯一母版路径后继续执行（未 AI 重绘、未换用其它图）。

---

## 1. Git Commit SHA

| # | SHA | 说明 |
|---|-----|------|
| 1 | `c1b66ea411e22b9d619068c310b0c33921e7bf0f` | feat(branding): add official ZRH blue-white logo assets |
| 2 | `9d5d061` | feat(branding): replace system logo references |
| 3 | `5e5d1d5e098c5b10c6c4471e1cb1959fa8099962` | feat(pwa): update logo generator and reference checks |

```
5e5d1d5e098c5b10c6c4471e1cb1959fa8099962 feat(pwa): update logo generator and reference checks
9d5d061 feat(branding): replace system logo references
c1b66ea411e22b9d619068c310b0c33921e7bf0f feat(branding): add official ZRH blue-white logo assets
```

---

## 2. 新增官方资源

**目录：** `frontend/public/branding/`

| 文件 | 用途 |
|------|------|
| `zrh-logo-blue-white-master.png` | **唯一正式母版** |
| `zrh-logo.png` | 全幅 4:3 展示 |
| `zrh-logo.svg` / `zrh-logo-dark.svg` / `zrh-logo-white.svg` | SVG 包装同一官方方图（无滤镜变色） |
| `zrh-logo-{16,32,48,64,96,128,180,192,256,512,1024}.png` | 等比方图画布 + contain + ~8% 留白 |
| `manifest-icon-192.png` / `manifest-icon-512.png` | PWA |
| `apple-touch-icon.png` | iOS |
| `favicon.ico` | branding 内副本 |
| `og-share-1200x630.png` | OG / Twitter |
| `splash-1280x720.png` / `splash-1080x1920.png` / `splash-2048.png` | Splash |

**兼容别名（内容已同步为新 Logo，避免旧缓存路径空窗）：**  
`frontend/public/brand/zrh-ai-icon-*.png`、`pwa-192/512`、`apple-touch-icon.png` 等。

**浏览器根 favicon：**  
`frontend/public/favicon.ico`、`favicon-16x16.png`、`favicon-32x32.png`

---

## 3. 替换文件数量 / 页面数量

| 指标 | 数量 |
|------|------|
| Commit 1 资源变更文件 | **50** |
| Commit 2 引用变更文件 | **6** |
| Commit 3 脚本文件 | **2** |
| 使用 `BrandMark` 的页面/组件（统一吃新路径） | Landing / Login / Register / ForgotPassword / Home / Chat / Knowledge / RAG / Workflows / Business / MCP / Developer / Admin / SuperAdmin / ReleaseNotes / AppShell / PwaInstallPrompt 等 **17+** |
| 代码中旧 `/brand/zrh-ai-icon*` 活跃引用（src/index/manifest/sw） | **0** |

---

## 4. 删除 / 归档旧 LOGO

| 动作 | 说明 |
|------|------|
| Git 删除 | `frontend/public/brand/zrh-ai-icon-official-v1-source.png`（旧母版源） |
| 本地回滚归档（未提交） | `frontend/_brand_archive_pre_official_blue_zrh_20260802/`（替换前全量 brand + favicon 副本） |
| 活跃引用 | 已切到 `/branding/*`；`/brand/*` 文件内容已重生为新 Logo（兼容残留外链） |

**删除旧 LOGO 数量（活跃源）：** 旧 official source **1**；其余旧像素已被同名文件覆盖为新母版派生（归档中保留替换前版本供回滚）。

---

## 5. 精确修改文件（白名单内）

- `frontend/public/branding/*`（新增）
- `frontend/public/brand/*`（重生 / 删旧 source）
- `frontend/public/favicon.ico` / `favicon-16x16.png` / `favicon-32x32.png`
- `frontend/public/manifest.json`
- `frontend/public/sw.js`（仅 CACHE 名 + PRECACHE 路径）
- `frontend/index.html`（icon / og / apple-touch 路径）
- `frontend/src/design-system/theme.ts`（`brandAssets` 路径）
- `frontend/src/design-system/BrandMark.tsx`（注释）
- `frontend/src/pwa/install.ts`（SW 版本 query）
- `frontend/scripts/generate-brand-assets.mjs`
- `frontend/scripts/check-official-logo-refs.mjs`

**未修改：** Backend、Prisma、API、Gateway、Knowledge/RAG/Workflow/Agent/MCP/Business 业务代码、i18n 文案、主题色 token、路由、菜单、权限。

---

## 6. 替换的 Logo 引用数量

| 区域 | 结果 |
|------|------|
| `brandAssets` 路径 | 全部改为 `/branding/zrh-logo-*` |
| `manifest.json` icons / screenshots | 全部 `/branding/...` |
| `index.html` favicon / apple / og / twitter | 全部新路径 |
| SW precache | `/branding/zrh-logo.svg` + manifest icons；CACHE=`zrh-ai-shell-v1.2.1-logo-official` |
| UI | 全部经 `BrandMark` → 新 `brandAssets`（无需逐页改业务 JSX） |

**旧 Logo 真实引用残余（代码扫描）：0**（`check-official-logo-refs.mjs` PASS）

---

## 7. 截图对比

| 证据 | 路径 / 说明 |
|------|-------------|
| 官方母版 | `frontend/public/branding/zrh-logo-blue-white-master.png` |
| 方图 192 | `frontend/public/branding/zrh-logo-192.png`（contain + 深蓝画布，主体完整） |
| 替换前归档 | `frontend/_brand_archive_pre_official_blue_zrh_20260802/`（本地） |
| 历史登录三语（旧图参考） | `docs/polish-screenshots/00~03-login-*.png` |

部署后建议赵总强制刷新对比：登录页大图 / 顶栏 / PWA 图标 / favicon。

---

## 8. 验收矩阵（本地资源层）

| # | 项 | 结果 |
|---|----|------|
| 1–4 | 登录 / 忘记密码 / 注册等 BrandMark | **PASS（路径层）** — 同源 `BrandMark` |
| 5–8 | PC/手机顶栏与抽屉 | **PASS（路径层）** — `AppShell` BrandMark |
| 11–13 | Admin / SuperAdmin | **PASS（路径层）** |
| 15–19 | PWA / Apple / maskable | **PASS（资源+manifest）** — 8% 安全边 |
| 20–21 | favicon | **PASS** |
| 23–25 | 三语文案 | **未改** |
| 26–30 | 登录/菜单/路由/数据 | **未改业务** |

---

## 9. Production Web / 公网 / PWA

| 项 | 状态 |
|----|------|
| Production Web 容器 | **`zrh-ai-web:1.2.1` 已重建并启动**（仅 `--no-deps zrh-ai-web`；未动 api/db/redis） |
| 回滚镜像标签 | `zrh-ai-web:1.2.1-pre-logo-official` |
| 服务器 frontend 备份 | `/home/zrh-admin/zrh-ai/backups/frontend-logo/frontend-pre-logo-*.tar.gz` |
| 公网母版 | `https://ai.zrhtech.com/branding/zrh-logo-blue-white-master.png` → **200**（133822 B） |
| 公网 512 | `.../branding/zrh-logo-512.png` → **200** |
| 公网 Apple / favicon / manifest | **200**；manifest icons 全部 `/branding/...` |
| PWA | 资源已切新路径；已装用户需硬刷新或重装以更新桌面图标缓存 |
| Backend 是否修改 | **否** |
| 数据库是否修改 | **否** |
| 业务逻辑是否修改 | **否** |
| 是否触碰用户/商户上传图 | **否** |
| 是否触碰无关模块 | **否** |
| 是否回滚 | **否** |

---

## 10. 回滚方案

1. 恢复 `brandAssets` / manifest / index / sw 至 `6e6d1f7`  
2. 或 `git revert` 上述 3 个 branding commits  
3. 从 `frontend/_brand_archive_pre_official_blue_zrh_20260802/` 拷回 `public/brand` 与 favicon  
4. 仅重建 `zrh-ai-web` 镜像并 `up -d --no-deps zrh-ai-web`

---

## 11. 正式上线资格

| 判定 | 说明 |
|------|------|
| 代码与资源 | **具备** — 唯一母版 + 全站引用统一 + 旧引用 0 |
| 生产生效 | **已发布** — `zrh-ai-web:1.2.1` healthy；公网 `/branding/*` 200 |
| 最终批准 | **等待赵总视觉终审** |

---

## 12. 最终核对清单（强制）

1. 修改前 HEAD：`6e6d1f7…`  
2. Commit SHA：`c1b66ea` / `9d5d061` / `5e5d1d5`  
3. 原始 Logo：`frontend/public/branding/zrh-logo-blue-white-master.png`  
4. 派生图标：见 §2  
5. 精确修改文件：见 §5  
6. 引用替换：BrandMark 全站 + manifest/HTML/SW  
7. 旧文件保留：本地 archive；Git 删旧 source  
8. 旧引用残余：**0**  
9–16. 用户端/后台/PWA/favicon：路径层通过；视觉以部署后为准  
17. 三语：未改  
18. Production Web：`zrh-ai-web:1.2.1` healthy；回滚标签 `1.2.1-pre-logo-official`  
19. Backend：**否**  
20. 数据库：**否**  
21. 业务逻辑：**否**  
22. 用户/商户图：**否**  
23. 无关模块：**否**  
24. 回滚：**未执行**（方案就绪）  
25. 上线资格：**具备 —— 等待赵总视觉终审**

---

*End of Report*
