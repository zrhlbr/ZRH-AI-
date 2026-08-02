# Brand Consistency Audit Report

**文档名称：** 《Brand Consistency Audit Report》  
**产品：** ZRH AI Enterprise  
**审计日期：** 2026-08-02  
**代码 tip：** `80345bc`（`test/v1.2`）  
**公网：** https://ai.zrhtech.com  
**范围：** 只读品牌一致性检查 + 缓存刷新建议  
**禁止项遵守：** 未修改 Backend / API / Database / Business Logic  

**审计结论（建议）：** **条件通过（Conditional Pass）——等待赵总最终确认**  
主路径 `/branding/*` 与运行时 `BrandMark` 已统一官方蓝白 Logo；发现 **Cloudflare 对旧路径 `/brand/*` 仍可能命中旧字节缓存**，以及 **Legacy 黑金主题仍可选**。

---

## 1. 检查总表

| # | 检查项 | 结果 | 说明 |
|---|--------|------|------|
| 1 | 是否还有旧 Logo（活跃 UI 引用） | **PASS** | `BrandMark` → `brandAssets` 全部 `/branding/zrh-logo-*`；`check-official-logo-refs.mjs` **PASS** |
| 2 | 是否还有旧品牌图片 | **条件** | 活跃页面无旧图；`/brand/*` 兼容别名在 **Origin 已是新图**，但 **CDN 边缘可能仍返回旧体积** |
| 3 | 是否还有旧配色 | **条件** | 默认 `blue-white` / Dark `blue-white-dark` 为科技蓝；**Legacy `black-gold`（`#d4af37`）仍在主题切换器中可选** |
| 4 | 是否还有旧字体 | **PASS** | UI 字体为 Space Grotesk + Noto Sans SC + Noto Sans Myanmar + JetBrains Mono；未见 Inter/Roboto 默认栈主导 |
| 5 | 是否还有旧 favicon | **PASS（主链）** | `index.html` → `/favicon-32x32.png` / `/favicon-16x16.png` / `/favicon.ico` / `/branding/zrh-logo.svg`；Origin/本地已换新 |
| 6 | 是否还有旧 PWA 图标 | **PASS（manifest）** | 公网 `manifest.json` icons/screenshots 全部 `/branding/*` |
| 7 | 是否还有旧 Open Graph | **PASS（主链）** | `og:image` / `twitter:image` → `/branding/og-share-1200x630.png`（深蓝科技底，非黑金） |
| 8 | 是否还有未更新的缓存资源 | **FAIL / 需处理** | 见 §8：CF 对 `/brand/zrh-ai-icon-512.png` 等边缘 **HIT 旧 Content-Length** |

---

## 2. 旧 Logo（活跃引用）

| 来源 | 状态 |
|------|------|
| `frontend/src/design-system/theme.ts` `brandAssets` | 全部 `/branding/...` |
| `BrandMark` 使用页面（Landing/Login/Register/Forgot/Home/Chat/Knowledge/RAG/Workflows/Business/MCP/Developer/Admin/SuperAdmin/ReleaseNotes/AppShell/PwaInstall） | 统一新路径 |
| `manifest.json` / `index.html` | 新路径 |
| 活跃代码引用 `/brand/zrh-ai-icon*` | **0**（`src` / `index.html` / `manifest`） |
| 本地归档（不对外） | `frontend/_brand_archive_pre_official_blue_zrh_20260802/` — 回滚用，非生产引用 |
| 历史文档截图 | `docs/polish-screenshots/*` 可能仍含旧登录图（文档证据，非运行时） |

**判定：** 运行时官方 Logo **已统一**；归档与历史文档不算产品运行态失败。

---

## 3. 旧品牌图片 / 路径双轨

| 路径族 | Origin（容器 :3010） | 公网 Cloudflare（审计时点） |
|--------|----------------------|-----------------------------|
| `/branding/zrh-logo-512.png` | **200 · 246817 B**（新） | **200 · 246817 B** · `cf-cache-status: HIT` |
| `/brand/zrh-ai-icon-512.png` | **200 · 246817 B**（新） | **200 · 348892 B** · `HIT` → **旧缓存字节** |
| `/brand/pwa-512.png` | **200 · 246817 B**（新） | **200 · 348892 B** · `HIT` → **旧缓存字节** |
| `/branding/og-share-1200x630.png` | 新 | **193264 B** · `MISS`（新） |
| `/brand/og-share-1200x630.png` | 新 | **193264 B** · `MISS`（新） |

**含义：**  
- 当前产品主链使用 `/branding/*`，用户正常打开应用应看到新 Logo。  
- 任何仍指向 `/brand/*` 的外链、书签、旧 SW 缓存或社交抓取，在 CF TTL（约 `max-age=14400`）内可能仍拿到旧图。  
- Origin 与本地磁盘上的 `/brand/*` **已是新图**；问题在 **边缘缓存**，非源文件未替换。

---

## 4. 旧配色

| 主题 | Accent | 是否默认 | 审计意见 |
|------|--------|----------|----------|
| `blue-white` | `#2563eb` | **是** | 符合蓝白科技 |
| `blue-white-dark` | `#3b82f6` | 用户可选 | 符合 |
| `black-gold` | `#d4af37` | Legacy，仍在 `themeOrder` / AppShell 色板 | **旧配色仍可达** |
| `deep-space-blue` / `midnight-black` | 深色族 | 可选 | 非默认 |

Tailwind 仍有 `gold` / `gold-soft` 别名，但映射为 `var(--zrh-accent)`（默认蓝）。  
**非 Logo 问题；属主题残留。** 本轮审计不改主题（需赵总另批是否下线黑金）。

---

## 5. 字体

| 用途 | 字体栈 |
|------|--------|
| UI / 品牌 | Space Grotesk |
| 中文 | Noto Sans SC |
| 缅文 | Noto Sans Myanmar / Padauk |
| 等宽 | JetBrains Mono |

**判定：PASS。** 未见以 Inter/Roboto/Arial 作为主品牌字体。  
（OG/Splash 生成脚本内嵌 SVG 文字使用 Segoe UI 回退——仅静态图烧录，不影响站点 CSS 字体。）

---

## 6. Favicon

| 资源 | 引用 | 状态 |
|------|------|------|
| `/favicon-32x32.png` | `index.html` | 本地 1685 B；公网 200 |
| `/favicon-16x16.png` | `index.html` | 本地 557 B |
| `/favicon.ico` | `index.html` | 公网 200（CF 曾 `EXPIRED`，会回源） |
| `/branding/zrh-logo.svg` | `index.html` SVG icon | 新 |

**判定：主链 PASS。** 浏览器强缓存可能导致个别标签页仍短暂显示旧 icon，建议硬刷新。

---

## 7. PWA 图标

| 项 | 状态 |
|----|------|
| 公网 `manifest.json` | 全部 `/branding/zrh-logo-*` / `manifest-icon-*` |
| `theme_color` / `background_color` | `#ffffff` |
| SW CACHE 名 | `zrh-ai-shell-v1.2.1-logo-official` |
| SW PRECACHE | `/branding/zrh-logo.svg` + manifest icons |
| 注册 query | `/sw.js?v=1.2.1-logo-official` |

**判定：配置 PASS。** 已安装到主屏幕的旧图标依赖 OS/浏览器图标缓存，需用户重装或清站点数据后更新。

---

## 8. Open Graph

| 项 | 状态 |
|----|------|
| `og:image` | `/branding/og-share-1200x630.png` |
| `twitter:image` | 同上 |
| 公网体积 | 193264 B（与新资源一致） |

**判定：PASS。** 社交平台侧缓存（Facebook/LinkedIn 等）不在本系统控制，分享预览可能滞后。

---

## 9. 未更新缓存资源（重点）

### 9.1 已确认问题

1. **Cloudflare 缓存 `/brand/*` 旧 PNG**  
   - 证据：边缘 `zrh-ai-icon-512` / `pwa-512` = **348892 B**（旧）  
   - Origin 同路径 = **246817 B**（新）  
2. **SW runtime 仍匹配 `pathname.startsWith('/brand/')` 写入缓存**  
   - 若客户端曾缓存旧 `/brand/*`，在 SW 升级前可能继续命中本地 Cache Storage  
   - 新 CACHE 名会在 activate 时删旧 cache key，但 **CF 边缘与浏览器 HTTP 缓存** 仍独立存在  
3. **Release Notes 三语文案仍写「部分 splash 仍为深色底」**  
   - Splash 已用新母版重生（深蓝科技底）；文案偏过时（属文案债务，本轮不改 i18n）

### 9.2 缓存刷新建议（仅建议，本轮不执行破坏性清缓存）

| 优先级 | 动作 | 说明 |
|--------|------|------|
| P0 | Cloudflare **Purge** `/brand/*` 与 `/favicon*`（或 Purge Everything 若赵总批准） | 消除边缘旧 HIT |
| P0 | 用户侧：硬刷新（Ctrl+F5）或清除站点数据 | 刷新 favicon / SW |
| P1 | 已装 PWA：卸载后重新「添加到主屏幕」 | 更新桌面图标 |
| P1 | 后续小改（需另批）：SW runtime 缓存条件增加 `/branding/`，并停止依赖 `/brand/` | 品牌缓存路径收敛 |
| P2 | 文档：更新 Brand Identity V1.0 路径说明至 `/branding/*` | 避免运维误用旧路径 |
| P2 | 赵总决定是否下线 `black-gold` 主题色板 | 配色一致性 |

**禁止：** 清除用户业务数据、登录态库、Redis 业务键；禁止动 Backend/API/DB。

---

## 10. 残余清单（非运行时阻塞）

| 类型 | 路径 / 位置 | 风险 |
|------|-------------|------|
| 兼容别名文件名 | `frontend/public/brand/zrh-ai-icon-*`（内容已是新 Logo） | 低（文件名旧、像素新）；CDN 需 purge |
| 本地回滚归档 | `frontend/_brand_archive_pre_official_blue_zrh_20260802/` | 无（不服务） |
| 历史 docs | `docs/ZRH-AI-Brand-Identity-V1.0-Report.md` 等仍写 `/brand/*` | 文档漂移 |
| Legacy 主题 | `black-gold` / `#d4af37` | 中（用户可选旧配色） |
| SW 条件 | `startsWith('/brand/')` 未含 `/branding/` | 中（缓存策略不完整） |
| 过时 knownIssues 文案 | splash 深色说明 | 低 |

---

## 11. 审计结论与审批

| 项 | 内容 |
|----|------|
| 运行时官方 Logo | **一致（新）** |
| 默认蓝白主题 / 字体 / favicon 主链 / PWA manifest / OG 主链 | **一致** |
| 需赵总关注 | ① CF purge `/brand/*` ② 是否下线黑金主题 ③ PWA 重装指引 |
| Backend / API / DB / 业务 | **未改动** |
| 审批状态 | **等待赵总最终确认** |

---

*End of Audit — ZRH AI Brand Consistency*
