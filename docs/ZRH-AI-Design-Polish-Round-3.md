# ZRH AI Design Polish Round 3

**Product:** ZRH AI Enterprise  
**Base:** Landing Background V2.0（已审批通过）+ Design System Blue White V2.0  
**Branch:** `test/v1.2`  
**Date:** 2026-08-03  
**Status:** 待赵总验收  
**Production:** **未部署 / 未改动**

---

## 1. 目标与边界

| 项 | 结果 |
|----|------|
| 优化留白 / 字体 / 层级 / 玻璃拟态 / Header / 手机体验 | **Done** |
| 禁止继续增加复杂动画 | **Done**（未新增复杂动效） |
| 锁定 Official Landing Background V2.0 | **Done** |
| 不修改业务逻辑 / API / DB | **Done** |

---

## 2. Round 3 交付

### 2.1 留白
- Landing：品牌 → 文案 → CTA 间距加大（`mt-10/12`、`mb-7/8`）
- Auth：`zrh-auth-stack` 统一 Safe Area 内边距；卡片内 `px-5/8 · py-6/8`
- 登录左右分栏右侧宽度略增（`26.5rem`），表单 gap `5`

### 2.2 字体与层级
- `typography.letterSpacing.brand`：`0.22em` → **`0.18em`**（中英更易读）
- 新增层级类：`.zrh-landing-display` / `.lead` / `.meta` / `.zrh-auth-title`
- 标题字重 700/600，正文 400；辅助 meta 更轻

### 2.3 玻璃拟态
- `.zrh-glass-card`：提高不透明度、降低饱和与模糊强度（桌面 16px / 手机 12px）
- 阴影更轻，蓝边更克制
- Landing PWA 卡片改用同一玻璃 token

### 2.4 Header
- 新增 `.zrh-landing-header`：Safe Area 顶/左右、轻毛玻璃、底部分割线、紧凑高度
- `LanguageSwitcher` 支持 `compact`（触控高度保留，字号略小）

### 2.5 手机体验
- `min-h-dvh` + Safe Area padding
- 手机端字距再收（`0.14em`）
- Header / Auth stack / Footer 底部 Safe Area
- 玻璃模糊手机降级，减轻 GPU

### 2.6 Official Background
- `TechBackground` 注释锁定为 **Official ZRH AI V2.0 Landing Background**
- 明确禁止继续叠加复杂动画
- 《Landing Background V2.0 Report》状态更新为审批通过 + Round 3 锁定

---

## 3. 修改文件

| 文件 | 用途 |
|------|------|
| `frontend/src/index.css` | landing header / type / glass / tracking |
| `frontend/src/design-system/typography.ts` | brand letter-spacing / line-height |
| `frontend/tailwind.config.js` | tracking-brand token |
| `frontend/src/components/LanguageSwitcher.tsx` | compact |
| `frontend/src/components/background/TechBackground.tsx` | Official 锁定 |
| `frontend/src/components/PwaInstallPrompt.tsx` | glass-card |
| `frontend/src/pages/LandingPage.tsx` | Header / 留白 / 层级 |
| `frontend/src/pages/LoginPage.tsx` | Auth polish |
| `frontend/src/pages/RegisterPage.tsx` | Auth polish |
| `frontend/src/pages/ForgotPasswordPage.tsx` | Auth polish |
| `frontend/src/pages/HomePage.tsx` | 欢迎区层级（视觉） |
| `docs/ZRH-AI-Landing-Background-V2.0-Report.md` | 审批通过 + Official |
| `docs/ZRH-AI-Design-Polish-Round-3.md` | 本报告 |

---

## 4. 验收清单

- [ ] Landing Header：不贴刘海 / 语言切换清晰  
- [ ] 品牌字距与层级清晰，无拥挤  
- [ ] 玻璃卡片轻盈、可读、非厚重毛玻璃  
- [ ] 登录 / 注册 / 忘记密码手机留白舒适  
- [ ] 无新增复杂动画  
- [ ] 背景仍为已批准的三层 Landing Background V2.0  

---

## 5. 停止声明

Round 3 完成后停止继续叠加动效与其它功能开发。  
**Official Landing Background V2.0 已锁定，等待赵总验收。**
