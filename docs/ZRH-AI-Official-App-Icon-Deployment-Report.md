# ZRH AI Official App Icon Deployment Report

**文档：** 《ZRH AI Official App Icon Deployment Report》  
**计划：** 《ZRH AI 桌面图标统一替换 V1.0》  
**日期：** 2026-08-02  
**公网：** https://ai.zrhtech.com  
**批准：** 赵总最终确认官方桌面图标（聊天上传图）  

---

## 0. 范围与隔离

| 用途 | 资源 | 是否本轮替换 |
|------|------|--------------|
| App Icon / PWA / Favicon / Splash / Launcher / Manifest / Install Banner | `app-icon-*` / favicon / splash / og-app-share | **是** |
| 登录 / Header / Sidebar / Admin / Super Admin / Developer / Knowledge 等横版 Logo | `zrh-logo-*` + `BrandMark` | **否（未改）** |

母版：`frontend/public/branding/zrh-ai-app-icon-master.png`（1024×1024）

---

## 1. 替换图标数量

| 类别 | 数量 |
|------|------|
| `app-icon-{16…1024}.png` 方图 | **15** |
| Maskable / Adaptive | **3**（192 / 512 / adaptive-432） |
| SVG | **2**（`app-icon.svg` · `safari-pinned-tab.svg`） |
| Splash | **3** |
| OG App Share | **1** |
| Favicon 根文件 | **3**（ico / 16 / 32） |
| Apple Touch / manifest aliases | **含 apple-touch · manifest-icon-192/512** |
| **合计新/更新文件（约）** | **~30+** |

横版 `zrh-logo-512.png` 体积仍为 **246817**（未覆盖）。

---

## 2. 生成尺寸

16 · 32 · 48 · 64 · 72 · 96 · 128 · 144 · 152 · 180 · 192 · 256 · 384 · 512 · 1024  
+ maskable 192/512 + adaptive 432 + SVG + ICO（48px PNG 兼容）

---

## 3. Manifest 更新

- `id`: `/zrh-ai-app-icon-v1`
- `start_url`: `/?source=pwa`
- `theme_color`: `#0b1220`
- `background_color`: `#05070d`
- `icons`: 全部指向 `/branding/app-icon-*`（含 maskable）
- `shortcuts`: Home → `/home` + app-icon-192
- `screenshots`: 新 splash（App Icon 居中）

---

## 4. PWA 更新

| 项 | 值 |
|----|----|
| SW CACHE | `zrh-ai-shell-v1.2.1-app-icon-v1` |
| SW 注册 | `/sw.js?v=1.2.1-app-icon-v1` |
| PRECACHE | `app-icon.svg` / 192 / 512 |
| Install Banner | `PwaInstallPrompt` 使用 `brandAssets.appIcon192`（非 BrandMark） |

**已安装用户：** 删除桌面旧 PWA → 重新安装 → 刷新图标。

---

## 5. Favicon 更新

- `/favicon.ico` · `/favicon-16x16.png` · `/favicon-32x32.png` ← App Icon  
- `index.html` icon / apple-touch / mask-icon / startup-image ← App Icon  
- query `?v=app-icon-v1` 破缓存  

---

## 6–9. 桌面 / Android / iPhone / Windows 验证

| 端 | 状态 |
|----|------|
| 资源层（manifest / favicon / splash） | **已部署路径就绪** |
| Windows Chrome / Edge 标签与安装图标 | **待赵总硬刷新 / 重装 PWA 目视确认** |
| Android Launcher / Adaptive / Maskable | **manifest maskable 已提供；待真机重装确认** |
| iPhone / iPad Home Screen | **apple-touch-icon 已更新；待 A2HS 重装确认** |

---

## 10. Git Commit SHA

（提交后回填；见 git log）

---

## 11. Docker 状态

仅重建 `zrh-ai-web`（预期 `1.2.1` healthy）。未动 api / db / redis。

---

## 12. 公网验证

部署后检查：

- `https://ai.zrhtech.com/branding/app-icon-512.png` → 200  
- `https://ai.zrhtech.com/manifest.json` → icons 含 `app-icon`  
- `https://ai.zrhtech.com/branding/zrh-logo-512.png` → 仍为横版 Logo（246817）  

---

## 约束核对

| 项 | 结果 |
|----|------|
| Backend / API / DB / 业务 | **未改** |
| 系统内横版 Logo | **未改** |
| 仅 App Icon 族 | **是** |

---

*End of Report*
