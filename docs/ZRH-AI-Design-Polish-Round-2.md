# ZRH AI Design Polish Round 2

**Product:** ZRH AI Enterprise（仅此产品）  
**Base:** Design System V2.0（蓝白科技风）  
**Branch:** `test/v1.2`  
**Date:** 2026-08-02  
**Status:** 待赵总最终审批  
**Production:** **未部署 / 未改动**  

---

## 1. 目标与边界

| 项 | 结果 |
|----|------|
| 优化 UI / UX / Animation / Typography / Spacing | **Done** |
| Dashboard / Chat / Logo / PWA / Brand | **Done** |
| 不修改业务逻辑 | **Done** |
| 不修改数据库 | **Done** |
| 不新增业务功能 | **Done** |
| 不启动 ZRHPay / Accounting / Router OS | **Done** |

---

## 2. Round 2 交付摘要

### 2.1 Typography & Tokens
- 增加 `caption` 字号、`lineHeight`、`tracking-brand` / `tracking-hud` Tailwind 工具类。
- 圆角 token 暴露为 `rounded-zrh-*`；阴影增加 `shadow-zrh-raised` / `header` / `modal`。
- Light 增加 `--zrh-bg-subtle`、`--zrh-code-bg`、`--zrh-shadow-header`。

### 2.2 Shell / Dashboard / Login
- **AppShell**：侧栏 `zrh-shell-aside`（浅灰底分离白底）、顶栏轻阴影、品牌字距统一、抽屉动效走 `motionTokens`。
- **Home**：首屏以品牌 + 输入为主；统计条下移至输入区下方；发送钮 `text-zrh-on-accent`；Logo 用 `shadow-zrh-glow`。
- **Login**：去掉表单 HUD 角标；Remember Me 自定义 checkbox；品牌光晕主题化。

### 2.3 Chat Experience
- 清除 Light 上 `bg-black/20` → `zrh-inset`（surface-raised）。
- 收藏 / 停止 / 状态点改用 `zrh-accent` / `zrh-warn` / `zrh-ok` / `zrh-err`（去 amber 硬编码）。
- 发送钮 `on-accent`；停止钮语义色 `zrh-err`。
- 消息气泡轻量入场 `.zrh-msg-enter`（尊重 `prefers-reduced-motion`）。
- Markdown 代码块改 `--zrh-code-bg`（Light 仍深底，保证高亮对比）。
- 空态 / 气泡品牌文案统一走 `brand` 常量。

### 2.4 Logo / Brand
- `BrandMark`：≤64px 优先 SVG，侧栏/顶栏更清晰。
- Logo 光晕统一 `shadow-zrh-glow`（跟随主题 accent）。
- `DigitalGlobe`：剔除金色径向光晕与 `#d4af37` 回落；跟随 `--zrh-accent`。

### 2.5 PWA
- iOS `apple-mobile-web-app-status-bar-style` → `default`（适配蓝白 Light）。
- Manifest：`any` / `maskable` 图标 purpose 拆分。
- `theme_color` 保持 `#2563eb`；`background_color` `#ffffff`。

### 2.6 Animation
- 页面进入 / 消息进入 / 抽屉缓动统一设计系统曲线。
- CSS 动画在 `prefers-reduced-motion` 下关闭。

---

## 3. 主要变更文件

| 区域 | 文件 |
|------|------|
| Tokens / CSS | `typography.ts`, `tailwind.config.js`, `index.css` |
| Brand | `BrandMark.tsx`, `DigitalGlobe.tsx` |
| Shell / Auth / Home | `AppShell.tsx`, `LoginPage.tsx`, `HomePage.tsx`, `RegisterPage.tsx`, `ForgotPasswordPage.tsx` |
| Chat | `ChatPage.tsx`, `ChatInput.tsx`, `MessageItem.tsx`, `ConversationList.tsx`, `ChatSidebar.tsx`, `MarkdownRenderer.tsx` |
| PWA | `index.html`, `public/manifest.json` |

---

## 4. 验证

| 检查 | 结果 |
|------|------|
| `tsc --noEmit`（frontend） | **Pass** |
| 业务 Store / API / Prisma | **未改** |
| Production 镜像 / 容器 | **未动** |

### 建议目视清单（测试栈）

- [ ] 登录页：白底蓝标、无金色地球光晕、checkbox 主题化  
- [ ] 首页：品牌 + 输入居中，统计在输入下方  
- [ ] 侧栏浅灰底与主区白底可区分  
- [ ] 对话：浅色搜索/控件底、收藏星为蓝、气泡入场克制  
- [ ] Dark Mode / Legacy 黑金仍可切换  
- [ ] Phone 抽屉遮罩与顶栏正常；PWA 状态栏非黑透  

---

## 5. 明确未做

- ❌ 未升级 ZRHPay / Accounting / Router OS  
- ❌ 未发布 Production  
- ❌ 未改业务逻辑 / 数据库 / 新功能  
- ❌ 未重绘全量 OG/产品截图（仍用品牌 splash）  

---

## 6. 请赵总最终审批

- [ ] 批准 Design Polish Round 2 作为 ZRH AI V1.2 视觉验收基线  
- [ ] 批准在测试栈重建前端镜像做联调（可选）  
- [ ] **不批准** 此时开始 Pay / Accounting / Router OS  
- [ ] **不批准** 此时 Production 发布（另案）  

**签字：** _______________　**日期：** ________

---

## 7. 关联文档

- `docs/ZRH-Technology-Group-Brand-Design-Specification-V2.0.md`  
- `docs/ZRH-AI-Design-System-V2.0-Implementation-Report.md`  
- `docs/ZRH-AI-Brand-Identity-V1.0-Report.md`  
