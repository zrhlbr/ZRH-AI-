# ZRH Technology Group  
# Brand Design Specification V2.0

**Status:** Draft — 等待赵总审批  
**Date:** 2026-08-02  
**Owner:** ZRH Technology Group / Brand & Product  
**Decision:** 赵总批准「蓝白科技风」为集团默认品牌视觉  

---

## 0. 决策摘要

| 项 | V2.0 决定 |
|----|-----------|
| **默认主题** | **蓝白科技风（Blue & White Tech）** |
| **黑金主题** | 降级为 **历史主题（Legacy）**，不再作为新版本默认 UI |
| **Dark Mode** | **保留**；默认 **关闭**；用户可手动开启 |
| **Logo** | 采用蓝色科技品牌图标体系（ZRH AI Official Icon V1.0 及集团衍生规范） |
| **本阶段范围** | **仅发布本规范文档**；**不得**一次性改全部产品 UI |
| **升级顺序（批准后）** | ① ZRH AI → ② ZRHPay → ③ ZRH Accounting → ④ ZRH Router OS → ⑤ 未来产品 |

**未经赵总批准：禁止批量改版任何产品界面。**

---

## 1. 品牌定位与视觉原则

### 1.1 品牌一句话

ZRH Technology Group — 企业级、可信、清晰的科技基础设施品牌。

### 1.2 视觉关键词

- 清晰 · 冷静 · 专业 · 可扩展  
- 蓝白主调 · 克制装饰 · 高可读性  
- 避免：廉价霓虹堆叠、默认紫渐变、奶油纸质风、报纸密排风

### 1.3 适用产品

| 产品 | 代号 | 升级时机 |
|------|------|----------|
| ZRH AI Enterprise | ZRH AI | 批准后第 1 批 |
| ZRHPay | ZRHPay | 批准后第 2 批 |
| ZRH Accounting | Accounting | 批准后第 3 批 |
| ZRH Router OS / Server OS | Router OS | 批准后第 4 批 |
| 未来 ZRH 产品 | — | 立项即采用 V2.0 |

### 1.4 主题层级（V2.0）

| 层级 | Theme ID（建议） | 用途 |
|------|------------------|------|
| **Default Light** | `blue-white` | **所有新产品 / 新版本默认** |
| Optional Dark | `blue-white-dark` | 用户手动开启 |
| Legacy | `black-gold` | 历史兼容；仅存量入口可选，不默认 |
| Legacy / Optional | `deep-space-blue` / `midnight-black` | 可保留为高级选项，不默认 |

---

## 2. 品牌色（Brand Colors）

### 2.1 Primary — 科技蓝

| Token | Hex | RGB | 用途 |
|-------|-----|-----|------|
| `--zrh-primary-600` | `#2563EB` | 37, 99, 235 | **主按钮 / 链接 / 关键操作** |
| `--zrh-primary-500` | `#3B82F6` | 59, 130, 246 | 默认强调、图标 |
| `--zrh-primary-400` | `#60A5FA` | 96, 165, 250 | Hover 高亮、图表次级 |
| `--zrh-primary-300` | `#93C5FD` | 147, 197, 253 | 浅 Hover 底、选中弱底 |
| `--zrh-primary-100` | `#DBEAFE` | 219, 234, 254 | 选中行、Tag 底、Focus 柔光 |
| `--zrh-primary-50` | `#EFF6FF` | 239, 246, 255 | 页面微 tint、空态 |

**主色选用原则：** 交互控件默认用 `primary-600`；大面积品牌氛围用 `primary-500`；禁止用金色作为默认 Primary。

### 2.2 Neutrals — 白与灰（Light）

| Token | Hex | 用途 |
|-------|-----|------|
| `--zrh-bg` | `#FFFFFF` | **页面背景（白）** |
| `--zrh-bg-subtle` | `#F8FAFC` | 次级背景、表格斑马纹可选 |
| `--zrh-surface` | `#FFFFFF` | **卡片 / 面板** |
| `--zrh-surface-raised` | `#F1F5F9` | 抬升区、侧栏弱底 |
| `--zrh-border` | `#E2E8F0` | **浅灰边框** |
| `--zrh-border-strong` | `#CBD5E1` | 分割强调、输入框边框 |
| `--zrh-text` | `#0F172A` | 主文本（近黑蓝灰） |
| `--zrh-text-secondary` | `#475569` | 次级文本 |
| `--zrh-text-muted` | `#94A3B8` | 占位、辅助说明 |

### 2.3 Semantic

| Token | Hex | 用途 |
|-------|-----|------|
| `--zrh-ok` | `#16A34A` | 成功 |
| `--zrh-warn` | `#D97706` | 警告 |
| `--zrh-err` | `#DC2626` | 错误 / 危险 |
| `--zrh-info` | `#0284C7` | 信息提示（可与 primary 区分） |

### 2.4 Legacy — 黑金（历史主题，非默认）

仅用于兼容存量「黑金」皮肤，**不得**作为 V2.0+ 新版本默认：

| Legacy Token | Hex | 备注 |
|--------------|-----|------|
| Gold Accent | `#D4AF37` | 历史强调色 |
| Dark BG | `#0A0A0B` | 历史背景 |

### 2.5 与官方 Logo 蓝的关系

ZRH AI Official Icon V1.0 为高饱和科技蓝 / 青蓝金属光。  
UI Primary 采用 **可访问对比度友好的蓝系（#2563EB 系）**，与 Logo 同属「科技蓝家族」，但 UI 不以霓虹描边铺满界面。

---

## 3. 字体（Typography）

### 3.1 字体栈（全球统一）

| 角色 | 字体 | 备注 |
|------|------|------|
| UI / Brand Latin | **Space Grotesk** | 标题、导航、数字 |
| 简体中文 | **Noto Sans SC** | 正文、表单 |
| 缅文 | **Noto Sans Myanmar** | my-MM |
| 等宽 | **JetBrains Mono** | 代码、ID、日志 |

**Fallback：** `PingFang SC, Microsoft YaHei, system-ui, sans-serif`

### 3.2 字号阶梯

| Token | Size | 典型用途 |
|-------|------|----------|
| `text-xs` | 12px | 辅助、Badge |
| `text-sm` | 14px | 表单标签、表格 |
| `text-base` | 16px | 正文 |
| `text-lg` | 18px | 小节标题 |
| `text-xl` | 20px | 页标题 |
| `text-2xl` | 24px | 模块 Hero 标题 |
| `text-3xl` | 30px | 营销/品牌大标题（慎用） |

### 3.3 字重与字距

| 用途 | Weight | Letter-spacing |
|------|--------|----------------|
| 正文 | 400 | normal |
| 强调 / 按钮 | 500–600 | normal |
| 品牌词「ZRH AI」 | 700 | `0.12em`–`0.22em`（品牌位） |
| 表格数字 | 500 · mono 可选 | normal |

### 3.4 可读性

- Light 主题正文对比度目标：**≥ WCAG AA**（正文 vs 白底）。  
- 禁止浅灰字（`#CBD5E1`）作为正文色。

---

## 4. 图标（Icons）

### 4.1 风格

- **线性 / 双色可选**：默认 1.5–2px stroke 线性图标。  
- **颜色：** 默认 `primary-500` / `primary-600`；次级用 `text-secondary`。  
- **禁止：** 彩虹多色图标散落、金色默认图标。

### 4.2 尺寸

| 场景 | Size |
|------|------|
| 行内 / 表单 | 16px |
| 导航 | 20px |
| 页头 | 24px |
| 空态插画旁 | 32–48px |

### 4.3 品牌 Logo 与功能图标分离

| 类型 | 规则 |
|------|------|
| **Brand Logo** | 仅用官方蓝标资产（见第 9 章） |
| **功能图标** | Lucide 或统一图标库；不得用 Logo 充当每个菜单项 |

---

## 5. 按钮（Buttons）

### 5.1 变体

| Variant | 外观 | 用途 |
|---------|------|------|
| **Primary** | 蓝底 `#2563EB` · 白字 | 主 CTA：登录、保存、提交 |
| **Secondary** | 白底 · 蓝边/灰边 · 蓝/深字 | 次要操作 |
| **Ghost** | 透明 · 蓝字 | 工具栏、轻操作 |
| **Danger** | 红底或红边 | 删除、不可逆 |
| **Link** | 无底 · `primary-600` 下划线可选 | 文内链接 |

### 5.2 状态

| State | Primary 规则 |
|-------|----------------|
| Default | `bg primary-600` |
| Hover | `bg primary-500` 或浅蓝底（Secondary） |
| Active / Pressed | `primary-600` 加深 4–8% |
| Disabled | 灰底灰字，无强调蓝 |
| Focus | `2px` ring：`primary-100` + `primary-600` 外环 |

### 5.3 尺寸

| Size | Height | Padding X | Radius |
|------|--------|-----------|--------|
| sm | 32px | 12px | 8px |
| md | 40px | 16px | 8–10px |
| lg | 48px | 20px | 10–12px |

**禁止：** 默认使用大圆角胶囊（`rounded-full`）作为所有主按钮；品牌 CTA 可用适度圆角，但不强制 pill。

---

## 6. 输入框（Inputs）

### 6.1 结构

- 标签：`text-sm` · `text-secondary` · 在上方  
- 控件：白底 · 边框 `#E2E8F0` · 圆角 8px  
- 占位符：`text-muted`  
- 辅助/错误文案：控件下方 12px

### 6.2 状态

| State | Border | Background |
|-------|--------|------------|
| Default | `#E2E8F0` | `#FFFFFF` |
| Hover | `#CBD5E1` | `#FFFFFF` |
| Focus | `#2563EB` | `#FFFFFF` + 浅蓝 ring |
| Error | `#DC2626` | `#FFFFFF` |
| Disabled | `#E2E8F0` | `#F8FAFC` |

### 6.3 密码 / 搜索 / 选择

- 同一套边框与焦点环。  
- Select / Textarea 与 Input 视觉对齐。  
- 复选框 / 开关：选中色 = Primary。

---

## 7. 表格（Tables）

### 7.1 外观

| 元素 | 规范 |
|------|------|
| 容器 | 白底卡片 + 浅灰边框 |
| 表头 | `bg #F8FAFC` · `text-secondary` · semibold · 14px |
| 行 | 白底；Hover `#F8FAFC` |
| 分割线 | `#E2E8F0` 水平线 |
| 选中行 | `#EFF6FF` |
| 数字列 | 右对齐；等宽字体可选 |

### 7.2 密度

| 密度 | 行高 |
|------|------|
| Comfortable | 48px |
| Default | 40–44px |
| Compact | 32–36px（管理后台可选） |

### 7.3 空态 / 加载

- 空态：居中说明 + 可选 BrandMark 或线性图标（蓝）。  
- 加载：骨架屏浅灰，避免整页黑遮罩。

---

## 8. 卡片（Cards）

### 8.1 默认卡片（Light）

| 属性 | 值 |
|------|-----|
| Background | `#FFFFFF` |
| Border | `1px solid #E2E8F0` |
| Radius | 12px（`lg`） |
| Shadow | **默认无重阴影**；可选极轻：`0 1px 2px rgba(15,23,42,0.06)` |
| Padding | 16–24px |

### 8.2 使用原则

- **默认：有边框白卡片。**  
- 交互容器（表单组、列表项）才需要卡片。  
- Hero / 品牌首屏：**不强制卡片化**；避免在首屏堆叠多卡片仪表盘（除非产品本身是 Dashboard）。  
- **禁止**默认使用多层霓虹 glow 边框。

### 8.3 Hover（可点击卡片）

- Border → `#CBD5E1` 或淡蓝 `#93C5FD`  
- 背景可微变为 `#F8FAFC`

---

## 9. Logo 使用规范

### 9.1 官方资产（ZRH AI）

以 **ZRH AI Official Icon V1.0（蓝色科技版）** 为 AI 产品主图标：

| 资产 | 建议路径（ZRH AI） |
|------|-------------------|
| Master 1024 | `/brand/zrh-ai-icon-1024.png` |
| SVG | `/brand/zrh-ai-icon.svg` |
| Favicon / PWA | 32–512 全套 |

其他产品（Pay / Accounting / Router OS）应使用 **同家族蓝色科技标**，允许产品字锁（Wordmark）差异，但 **主色与构图语言一致**。

### 9.2 安全区与最小尺寸

| 规则 | 值 |
|------|-----|
| 安全区 | Logo 四周 ≥ Logo 短边的 **12.5%** |
| 数字产品最小显示 | **24px**（导航） |
| Favicon | 16 / 32（保证「ZRH」可识别时可裁切为简化标） |
| 禁止 | 拉伸变形、改色为金/紫、添加杂乱贴纸、低对比灰底强行叠黑金滤镜 |

### 9.3 与蓝白 UI 的组合

| 场景 | Logo 版本 |
|------|-----------|
| 白底导航 / 登录 | 官方蓝标（完整） |
| 深色 Dark Mode | 官方蓝标（完整）；必要时加极轻白底衬底 |
| 印刷 / 单色 | 预留 Mono 蓝 / 墨版（后续资产） |

### 9.4 Wordmark

- 产品名：**ZRH AI** / **ZRHPay** / **ZRH Accounting** / **ZRH Router OS**  
- 集团署名：**ZRH 科技集团** · **ZRH TECHNOLOGY GROUP**  
- 中英文可并列；品牌字母间距见字体章。

---

## 10. 导航（Navigation）

### 10.1 顶栏（Topbar）— Light

| 属性 | 值 |
|------|-----|
| Height | 56–64px |
| Background | `#FFFFFF` |
| Border Bottom | `#E2E8F0` |
| Logo | 左：BrandMark + Wordmark |
| 文本 | 主色深字；激活项蓝字或蓝底弱填充 |

### 10.2 侧栏（Sidebar）— Light

| 属性 | 值 |
|------|-----|
| Width | 224–256px |
| Background | `#FFFFFF` 或 `#F8FAFC` |
| 激活项 | `bg primary-50` · `text primary-600` · 可选左侧 2–3px 蓝条 |
| Hover | `#F1F5F9` |
| 图标 | 蓝 / 次级灰 |

### 10.3 移动端

- 抽屉导航；遮罩 `rgba(15,23,42,0.4)`。  
- 触摸目标 ≥ 40px。

---

## 11. Light Theme（默认）

### 11.1 总表

| Token | Value |
|-------|-------|
| Background | `#FFFFFF` |
| Surface / Card | `#FFFFFF` + border `#E2E8F0` |
| Primary | `#2563EB` |
| Hover | `#60A5FA` / `#DBEAFE` |
| Link | `#2563EB` |
| Text | `#0F172A` |
| Icon | Tech Blue |
| Button | Blue primary |

### 11.2 CSS 变量草案（Light）

```css
:root,
[data-theme="blue-white"] {
  --zrh-bg: #ffffff;
  --zrh-bg-subtle: #f8fafc;
  --zrh-surface: #ffffff;
  --zrh-surface-raised: #f1f5f9;
  --zrh-border: #e2e8f0;
  --zrh-border-strong: #cbd5e1;
  --zrh-border-glow: rgba(37, 99, 235, 0.25);
  --zrh-accent: #2563eb;          /* V2.0：Primary = 科技蓝 */
  --zrh-accent-soft: #3b82f6;
  --zrh-tech-blue: #3b82f6;
  --zrh-primary-50: #eff6ff;
  --zrh-primary-100: #dbeafe;
  --zrh-primary-300: #93c5fd;
  --zrh-primary-400: #60a5fa;
  --zrh-primary-500: #3b82f6;
  --zrh-primary-600: #2563eb;
  --zrh-text: #0f172a;
  --zrh-text-dim: #64748b;
  --zrh-ok: #16a34a;
  --zrh-warn: #d97706;
  --zrh-err: #dc2626;
  color-scheme: light;
}
```

---

## 12. Dark Theme（可选，默认关闭）

### 12.1 原则

- **默认关闭。** 首次访问 = Light。  
- 用户显式切换后写入本地偏好（如 `localStorage`）。  
- Dark 仍是 **蓝科技**，不是回到默认黑金。

### 12.2 Dark Token 草案

| Token | Value |
|-------|-------|
| `--zrh-bg` | `#0B1220` |
| `--zrh-surface` | `#111827` |
| `--zrh-surface-raised` | `#1F2937` |
| `--zrh-border` | `#334155` |
| `--zrh-accent` / Primary | `#3B82F6` |
| `--zrh-text` | `#F8FAFC` |
| `--zrh-text-dim` | `#94A3B8` |
| Card | 深面 + 细边，而非纯黑无边界 |

```css
[data-theme="blue-white-dark"] {
  --zrh-bg: #0b1220;
  --zrh-bg-subtle: #0f172a;
  --zrh-surface: #111827;
  --zrh-surface-raised: #1f2937;
  --zrh-border: #334155;
  --zrh-border-strong: #475569;
  --zrh-border-glow: rgba(96, 165, 250, 0.35);
  --zrh-accent: #3b82f6;
  --zrh-accent-soft: #60a5fa;
  --zrh-tech-blue: #38bdf8;
  --zrh-text: #f8fafc;
  --zrh-text-dim: #94a3b8;
  --zrh-ok: #22c55e;
  --zrh-warn: #fbbf24;
  --zrh-err: #f87171;
  color-scheme: dark;
}
```

### 12.3 切换入口

- 设置 / 顶栏：Light · Dark（可选再保留 Legacy 黑金）。  
- **新产品默认选中 Light。**

---

## 13. Design Token 体系

### 13.1 分层

```
Primitive（原始色板）
  → Semantic（bg / surface / accent / text / ok…）
    → Component（button.primary.bg / input.border / table.header.bg…）
```

### 13.2 命名约定

| 层级 | 示例 |
|------|------|
| CSS | `--zrh-primary-600` |
| TS | `blueWhiteColors.accent` |
| Tailwind（建议） | `bg-zrh-bg` · `text-zrh-accent` · `border-zrh-border` |

### 13.3 间距 / 圆角 / 阴影（跨产品统一）

| 类型 | Token | 值 |
|------|-------|-----|
| Spacing base | 4px grid | 4 / 8 / 12 / 16 / 24 / 32 / 48 |
| Radius sm/md/lg | 6 / 8 / 12px | 输入 / 按钮 / 卡片 |
| Shadow (light) | soft | `0 1px 2px rgba(15,23,42,.06)` |
| Focus ring | — | Primary 浅底 + 蓝环 |
| Breakpoints | sm–2xl | 640 / 768 / 1024 / 1280 / 1536 |

### 13.4 动效（克制）

| Token | 建议 |
|-------|------|
| Duration | 150–250ms |
| Easing | standard ease-out |
| 用途 | 抽屉、Hover、Toast；禁止炫光循环作为默认氛围 |

---

## 14. 组件速查（跨产品）

| 组件 | Light 要点 |
|------|------------|
| Button | 蓝主按钮；Hover 浅蓝 |
| Input | 白底浅灰边；Focus 蓝环 |
| Table | 白卡片 + 浅表头 |
| Card | 白 + `#E2E8F0` 边 |
| Nav | 白底；激活蓝 |
| Link | `#2563EB` |
| Badge | 蓝浅底 / 灰浅底 |
| Modal | 白面板 + 遮罩 slate |
| Toast | 白/语义色左边条 |
| Tabs | 激活蓝下划线或浅蓝底 |

---

## 15. Figma 规范（如适用）

### 15.1 文件结构建议

```
ZRH Technology Group — Design System V2.0
├── 🔒 Foundations
│   ├── Color (Primitives + Semantic)
│   ├── Typography
│   ├── Grid & Spacing
│   └── Effects
├── 🧩 Components
│   ├── Button / Input / Select
│   ├── Card / Table / Nav
│   └── Feedback
├── 🏷 Brand
│   ├── Logo / BrandMark
│   └── Product Wordmarks
└── 📄 Patterns
    ├── Auth
    ├── Settings
    └── Admin Console
```

### 15.2 Figma Variables

- Collection：**ZRH / Light** · **ZRH / Dark** · **ZRH / Legacy Black-Gold**  
- Modes 绑定到 Semantic tokens（与第 11–12 章一一对应）。  
- Component 使用 Variables，禁止组件内写死 Hex（除插画）。

### 15.3 交付物（批准后制作）

- [ ] Figma Library 发布  
- [ ] Logo 全尺寸导出包（各产品）  
- [ ] 开发 Design Tokens JSON / CSS  
- [ ] 无障碍对比度抽检报告  

*本阶段不强制已存在 Figma 文件；规范已可直接指导工程落地。*

---

## 16. 产品升级治理（批准后执行）

### 16.1 原则

1. **一次只升级一个产品。**  
2. 先 Token / Theme，再组件，再页面。  
3. 业务逻辑与接口 **不借品牌升级顺带改版。**  
4. 黑金可作为「外观 → 历史主题」选项保留至少一个大版本。

### 16.2 建议顺序与验收门禁

| Order | Product | 门禁 |
|------:|---------|------|
| 1 | **ZRH AI** | Light 默认；登录/壳/Chat 主路径；Dark 可切换；三语言 |
| 2 | ZRHPay | 支付主色与按钮一致；无业务回归 |
| 3 | Accounting | 表格/表单密度符合规范 |
| 4 | Router OS | 控制台导航与状态色一致 |

每产品完成后输出：`《{Product} Brand UI 2.0 Migration Report》`，再进入下一产品。

### 16.3 明确禁止（本阶段）

- ❌ 一次性改 ZRH AI + Pay + Accounting + Router OS  
- ❌ 未批准即删除黑金主题代码（可降级默认，不可强删无迁移）  
- ❌ 用品牌升级夹带大功能开发  

---

## 17. 对照：V1.x → V2.0

| 项 | V1.x（历史） | V2.0 |
|----|--------------|------|
| 默认主题 | 黑金 | **蓝白科技** |
| Primary | 金 `#D4AF37` | **蓝 `#2563EB`** |
| Background | 近黑 | **白 `#FFFFFF`** |
| Card | 深玻璃 / glow | **白 + 浅灰边** |
| Logo | 可用蓝标 + 黑金壳 | **蓝标 + 蓝白壳** |
| Dark | 常与黑金耦合 | **独立蓝 Dark，默认关** |

---

## 18. 审批

请赵总确认：

- [ ] **蓝白科技风** 定为 ZRH Technology Group 默认品牌视觉  
- [ ] **黑金** 降为历史主题，不再作为新版本默认  
- [ ] Dark Mode 保留且默认关闭  
- [ ] 批准后按 **AI → Pay → Accounting → Router OS** 逐个升级  
- [ ] 本阶段 **仅规范文档生效**，不自动改全部 UI  

**签字：** _______________　**日期：** ________

---

## 19. 文档控制

| 字段 | 值 |
|------|-----|
| Document ID | ZRH-BRAND-DS-V2.0 |
| Path | `docs/ZRH-Technology-Group-Brand-Design-Specification-V2.0.md` |
| Related | `docs/ZRH-AI-Brand-Identity-V1.0-Report.md`（Logo 资产） |
| Next | 赵总批准 → 《ZRH AI Brand UI 2.0 Migration Plan》 |
