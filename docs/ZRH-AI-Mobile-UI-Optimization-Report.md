# ZRH AI V1.2.2 Mobile UI/UX Optimization Report

**分支：** `test/v1.2`  
**范围：** Layout / Responsive / i18n / PWA 视觉壳层  
**日期：** 2026-08-03  
**Production 影响：** **0**（未部署）

---

## 1. 修改文件

| 文件 | 用途 |
|------|------|
| `frontend/src/pages/HomePage.tsx` | 去实时状态/统计；Logo+欢迎语+输入框居中；宽 92%、圆角 16px |
| `frontend/src/components/AppShell.tsx` | Safe-area Header；`h-dvh` 固定壳；Content 独立滚动；手机底栏 |
| `frontend/src/index.css` | overflow-x 锁；底栏安全区；聊天区高度适配；字体行高 |
| `frontend/src/design-system/typography.ts` | Mobile 字重/行高约定 |
| `frontend/src/i18n/locales/zh-CN.json` | `shell.bottomNav` / `shell.more` |
| `frontend/src/i18n/locales/en-US.json` | 同上 |
| `frontend/src/i18n/locales/my-MM.json` | 同上 |
| `frontend/scripts/mobile-ui-screenshots.mjs` | 验收截图脚本 |
| `docs/mobile-ui-screenshots/*` | iPhone / Android / Pad / PC 截图 |
| `docs/ZRH-AI-Mobile-UI-Optimization-Report.md` | 本报告 |

**未修改：** Chat / Knowledge / RAG / Workflow / Developer / Business / Agent / MCP / Mail / Backend / API / DB。

---

## 2. 首页去状态化

已删除（组件级，非隐藏）：

- 实时状态 aside（CPU / GPU / Memory / Docker / Redis / PostgreSQL / AI Runtime / Engines）
- chatStats（引擎/聊天/消息计数）
- 监控轮询 `useEffect`

保留：Logo · `t('home.welcomeGreeting')` · 输入框 → `/chat`。

---

## 3. 壳层布局

- 外层：`h-dvh max-h-dvh overflow-hidden`
- Header：`padding-top: env(safe-area-inset-top)`，手机顶栏压缩
- `main.zrh-shell-content`：`flex-1 min-h-0 overflow-y-auto overflow-x-hidden`
- BottomNav（lg 以下）：首页 / 对话 / 知识 / 我的（`menu:*` 过滤）+「更多」打开抽屉
- 桌面：左侧栏，无底栏
- `body` 在 AppShell 挂载期间 `overflow: hidden`

---

## 4. 三语言

| Key | zh-CN | en-US | my-MM |
|-----|-------|-------|-------|
| `shell.bottomNav` | 底部导航 | Bottom navigation | အောက်ခြေလမ်းညွှန် |
| `shell.more` | 更多 | More | ပိုမို |

---

## 5. 截图

`docs/mobile-ui-screenshots/`：

- `login-iphone.png` / `landing-iphone.png`
- `login-android.png` / `landing-android.png`
- `login-pad.png` / `landing-pad.png`
- `login-pc.png` / `landing-pc.png`

---

## 6. 验证

| 项 | 结果 |
|----|------|
| TypeCheck | PASS |
| Build | PASS |
| 横向滚动锁 | CSS + shell |
| StatusPage `/status` | **未改**（Admin 仍用原页） |

---

## 7. Git Commit

- **SHA：** `a85111e`  
- **Message：** `feat(ui): optimize mobile shell layout and clean home status panels`

---

## 8. Production Impact

**0** — 不部署、不碰生产。

---

**等待验收。**
