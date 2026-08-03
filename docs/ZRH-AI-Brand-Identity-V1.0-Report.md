# ZRH AI Brand Identity V1.0 Report

**Product:** ZRH AI Enterprise  
**Icon:** ZRH AI Official Icon V1.0（蓝色科技版）  
**Theme:** 黑金 UI + 蓝色科技图标  
**Branch:** `test/v1.2`  
**Date:** 2026-08-02  
**Scope:** 品牌资产与展示层（未改业务逻辑 / API / Store）

---

## 1. 官方图标

| 项 | 说明 |
|----|------|
| 名称 | ZRH AI Official Icon V1.0 |
| 风格 | 蓝色科技 · 电路纹理 · 金属字标 · Squircle |
| 主色 | Tech Blue / Neon Cyan on Charcoal Black |
| 与主题关系 | UI 保持黑金（`--zrh-accent` 金）；品牌图标保持官方蓝 |

源文件：`frontend/public/brand/zrh-ai-icon-official-v1-source.png`  
主图：`frontend/public/brand/zrh-ai-icon-official-v1.png`（1024）

---

## 2. 生成尺寸清单

| Size | Path |
|-----:|------|
| 1024 | `/brand/zrh-ai-icon-1024.png` |
| 512 | `/brand/zrh-ai-icon-512.png` · `/brand/pwa-512.png` |
| 256 | `/brand/zrh-ai-icon-256.png` |
| 192 | `/brand/zrh-ai-icon-192.png` · `/brand/pwa-192.png` |
| 180 | `/brand/zrh-ai-icon-180.png` · `/brand/apple-touch-icon.png` |
| 96 | `/brand/zrh-ai-icon-96.png` |
| 64 | `/brand/zrh-ai-icon-64.png` |
| 48 | `/brand/zrh-ai-icon-48.png` |
| 32 | `/brand/zrh-ai-icon-32.png` · `/favicon-32x32.png` |
| SVG | `/brand/zrh-ai-icon.svg` · `/brand/zrh-ai-icon-inline.svg` |

附加：

| Asset | Path |
|-------|------|
| Favicon 16 | `/favicon-16x16.png` |
| Favicon | `/favicon.ico`（48 PNG 兼容入口） |
| Open Graph | `/brand/og-share-1200x630.png` |
| Splash Desktop | `/brand/splash-1280x720.png` |
| Splash Mobile | `/brand/splash-1080x1920.png` |
| Splash Square | `/brand/splash-2048.png` |
| PWA Manifest | `/manifest.json` |

再生命令（前端目录）：

```bash
node scripts/generate-brand-assets.mjs
```

---

## 3. 替换范围（完成）

| 表面 | 状态 |
|------|------|
| 网站 Logo（AppShell 侧栏 / 顶栏 / 抽屉） | Done — `BrandMark` |
| 登录页 | Done |
| 注册 / 忘记密码 | Done |
| Home | Done |
| Chat | Done（空态 + 顶栏） |
| Knowledge | Done（页头） |
| Enterprise RAG | Done（页头） |
| Developer | Done（侧栏标题） |
| Workflow | Done（页头） |
| MCP | Done（页头） |
| Business Hub | Done（页头） |
| Admin | Done（Dashboard 头） |
| Super Admin | Done（Overview 头） |
| Favicon | Done — `index.html` |
| Apple Touch / Splash | Done |
| Open Graph / Twitter Card | Done — meta |
| PWA `manifest.json` 图标 | Done |

---

## 4. 工程落点（非业务代码）

| 文件 | 作用 |
|------|------|
| `frontend/public/brand/*` | 图标 / Splash / OG 资产 |
| `frontend/public/manifest.json` | PWA 图标清单 |
| `frontend/index.html` | favicon / OG / apple / manifest 链接 |
| `frontend/src/design-system/theme.ts` | `brandAssets` 路径常量 |
| `frontend/src/design-system/BrandMark.tsx` | 统一品牌图组件 |
| `frontend/scripts/generate-brand-assets.mjs` | 尺寸生成脚本 |
| 各 Page / AppShell | **仅**品牌展示替换为 `BrandMark` |

**明确未改：** Chat/Auth/Knowledge/RAG/Workflow/MCP/Developer/Business 的 API、Store、权限与运行时逻辑。

---

## 5. 使用规范

1. **禁止**用 Lucide / 临时插画替代官方图标作为品牌 Logo。  
2. 导航模块功能图标（Home、Tools 等）可继续用 Lucide；**品牌位**只用 Official Icon。  
3. 小尺寸（≤32）优先 `zrh-ai-icon-32.png`；大展示用 192+。  
4. 分享图必须用 `og-share-1200x630.png`（黑金底 + 蓝标）。  
5. SVG：外链版 `zrh-ai-icon.svg`；离线嵌入用 `zrh-ai-icon-inline.svg`。

---

## 6. 验收清单

- [x] 全尺寸 PNG + SVG 已生成  
- [x] Favicon / Apple Touch / Manifest 已挂载  
- [x] OG 分享图已挂载  
- [x] Splash 桌面/移动已生成  
- [x] 登录与主导航品牌位已替换  
- [x] 各业务模块页头品牌位已替换  
- [x] 黑金主题 CSS 未改为纯蓝主题  
- [x] 业务逻辑未改动  
- [x] `tsc` 通过  

---

## 7. 审批

请赵总确认：

- [ ] Official Icon V1.0 作为全球唯一品牌主图标  
- [ ] 黑金 UI + 蓝色科技图标组合定稿  

**签字：** _______________　日期：________
