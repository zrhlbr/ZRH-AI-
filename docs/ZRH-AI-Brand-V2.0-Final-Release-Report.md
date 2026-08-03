# ZRH AI Brand V2.0 Final Release Report

**文档名称：** 《ZRH AI Brand V2.0 Final Release Report》  
**日期：** 2026-08-02  
**公网：** https://ai.zrhtech.com  
**分支 tip（审计时）：** `f0a26a2` / branding tip `5e5d1d5`+  
**项目状态变更：** **Brand Upgrade → CLOSED** · **进入 Maintenance Mode**  
**约束：** 本轮仅缓存清理与验证；未改 Backend / API / Database / Business Logic  

---

## 0. 执行摘要

| 项 | 结果 |
|----|------|
| Origin 最新 Logo / favicon / OG / PWA 资源 | **已就绪**（容器旁路尺寸与本地一致） |
| 活跃 UI 路径 `/branding/*` 公网 | **已是最新** |
| Cloudflare Purge | **未完成（缺 API 凭据）** — 见 §1 |
| 兼容路径 `/brand/*` 公网边缘 | **仍可能 HIT 旧字节**（348892 vs Origin 246817） |
| Brand Upgrade | **正式关闭** |
| 后续品牌修改 | **禁止**，除非赵总重新批准 |

---

## 1. Cloudflare Purge 是否完成

| 项 | 状态 |
|----|------|
| API Token / Zone ID（本机 / 仓库 `.env`） | **未配置**（`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID` 均 ABSENT） |
| 自动 Purge 执行 | **否** |
| 已准备脚本 | `scripts/purge-cf-brand-cache.ps1`（凭据就绪后一键 purge URL 列表） |

### 1.1 赵总 Dashboard 手动 Purge（推荐立即执行）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → 选择 **zrhtech.com**（或承载 `ai.zrhtech.com` 的 Zone）  
2. **Caching** → **Configuration** → **Purge Cache**  
3. 选择 **Custom Purge** → **URL**（或 Free 计划可用 **Purge Everything**）  
4. 至少 purge：

```
https://ai.zrhtech.com/brand/
https://ai.zrhtech.com/branding/
https://ai.zrhtech.com/favicon.ico
https://ai.zrhtech.com/favicon-16x16.png
https://ai.zrhtech.com/favicon-32x32.png
https://ai.zrhtech.com/manifest.json
https://ai.zrhtech.com/sw.js
https://ai.zrhtech.com/sw.js?v=1.2.1-logo-official
https://ai.zrhtech.com/apple-touch-icon.png
https://ai.zrhtech.com/og-image.png
```

（若 UI 不支持目录前缀，请 purge 具体文件；完整列表见 `scripts/purge-cf-brand-cache.ps1`。）

5. 或配置环境变量后执行：

```powershell
$env:CLOUDFLARE_API_TOKEN = '<token>'   # Zone → Cache Purge
$env:CLOUDFLARE_ZONE_ID   = '<zone_id>'
powershell -File scripts/purge-cf-brand-cache.ps1
```

**判定：** Cloudflare Purge = **未完成 / 待赵总操作或提供 Token**。

---

## 2. 所有 Logo 是否更新

| 检查点 | Origin | 公网 Edge（purge 前） |
|--------|--------|----------------------|
| `/branding/zrh-logo-512.png` | **246817** 新 | **246817** 新 · HIT |
| `/branding/zrh-logo-blue-white-master.png` | 新 | **133822** 新 · HIT |
| `/brand/zrh-ai-icon-512.png` | **246817** 新 | **348892** **旧缓存** · HIT |
| `/brand/pwa-512.png` | **246817** 新 | **348892** **旧缓存** · HIT |
| UI `BrandMark` → `/branding/*` | 新 | 新 |

**结论：** 产品主路径 Logo **已更新**；兼容旧路径在 CDN 上 **仍可能显示旧图**，需 Purge 后对齐。

---

## 3. PWA 是否更新

| 项 | 状态 |
|----|------|
| `manifest.json` icons | 全部 `/branding/*`（公网已确认） |
| SW | `zrh-ai-shell-v1.2.1-logo-official` · precache `/branding/...` |
| 安装横幅 BrandMark | 走新 `/branding` |
| 已安装桌面图标 | **依赖 OS/浏览器图标缓存** — 见下方提示 |

### PWA 已安装用户提示（必读）

由于品牌资源更新，  
建议：

1. **删除桌面旧 PWA**  
2. **重新安装**（浏览器「安装 ZRH AI」或 iOS「添加到主屏幕」）  
3. **刷新图标**（必要时清除站点数据后重装）

---

## 4. Favicon 是否更新

| 资源 | 本地/Origin | 公网 |
|------|-------------|------|
| `/favicon.ico` | 3326 | 3326 · HIT |
| `/favicon-32x32.png` | 1685 | 1685 · HIT |
| `/branding/zrh-logo.svg` | 新 | 新 |

**结论：** Favicon **已更新**（个别浏览器标签可能需硬刷新 Ctrl+F5）。

---

## 5. OG 是否更新

| 资源 | 状态 |
|------|------|
| `/branding/og-share-1200x630.png` | 公网 **193264** 与本地一致 · HIT（新） |
| `index.html` `og:image` / `twitter:image` | 指向上述路径 |

**结论：** OG **已更新**。第三方社交抓取缓存不在本系统控制。

---

## 6. 缓存状态

| 层 | 状态 |
|----|------|
| Origin `zrh-ai-web:1.2.1` | 新资源齐全 |
| Cloudflare `/branding/*` | 新 · HIT |
| Cloudflare `/brand/*` | **旧 HIT（待 Purge）** |
| SW CACHE | `v1.2.1-logo-official`（新 key） |
| CF `max-age` | 约 14400s（4h）— 不 purge 则旧 `/brand/*` 可能持续至过期 |

**Purge 后验收命令（赵总执行后请复查）：**

```powershell
curl.exe -sS -D - -o NUL https://ai.zrhtech.com/brand/zrh-ai-icon-512.png | findstr /i "Content-Length cf-cache"
# 期望 Content-Length: 246817 且随后变为 MISS/EXPIRED/REVALIDATED 后的新 HIT
```

---

## 7. 最终截图

| 证据 | 说明 |
|------|------|
| 官方母版 | `frontend/public/branding/zrh-logo-blue-white-master.png` |
| 方图 192/512 | `frontend/public/branding/zrh-logo-192.png` / `zrh-logo-512.png` |
| 本轮浏览器自动化 | 不可用；请赵总 Purge 后在 Chrome / Edge / Android / iPhone 各截一张登录页 |
| 历史三语登录参考 | `docs/polish-screenshots/00~03-login-*.png`（旧图，仅历史） |

---

## 8. 设备核对清单（Purge 后由赵总勾选）

| 端 | 动作 | 期望 |
|----|------|------|
| Chrome | 硬刷新登录页 | 最新官方 Logo |
| Edge | 硬刷新登录页 | 最新官方 Logo |
| Android Chrome | 打开站点 +（如已装）重装 PWA | 最新 Logo / 图标 |
| iPhone Safari | 打开站点 +（如已加主屏幕）重装 | 最新 Logo / 图标 |
| PWA Standalone | 删除旧图标后重装 | 最新安装图标 |

---

## 9. 项目关闭声明

### Brand Upgrade V2.0 — **CLOSED**

已完成：

- 官方蓝白母版落地与派生  
- 全站 `BrandMark` / manifest / favicon / OG / splash 主路径切换  
- 生产 Web 镜像发布  
- 品牌一致性审计  
- Maintenance 规则：`.cursor/rules/zrh-ai-brand-maintenance.mdc`

未完成（阻塞项）：

- **Cloudflare Cache Purge**（缺凭据）

### Maintenance Mode — **ACTIVE**

以后：

- **禁止修改品牌**（Logo / 图标 / OG / 品牌资源路径 / 默认品牌主题）  
- **除非：赵总重新批准**

---

## 10. 最终判定

| 判定 | 说明 |
|------|------|
| 品牌资源发布 | **完成** |
| CDN 全面一致 | **待 Purge** |
| Brand Upgrade 关闭 | **是** |
| Maintenance Mode | **是** |
| 等待 | **赵总：Dashboard Purge（或提供 API Token）→ 设备终检勾选** |

---

*End of Report — ZRH AI Brand V2.0 Final Release*
