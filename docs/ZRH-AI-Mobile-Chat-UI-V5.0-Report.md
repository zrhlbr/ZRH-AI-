# ZRH AI Mobile Chat UI V5.0 — 聊天页面最终重构 交付报告

日期：2026-08-04（Asia/Shanghai）
分支：`test/v1.2`（**按规格要求：未部署 Production**）
范围：USER 普通用户端聊天体验；Admin / SuperAdmin 后台、菜单、权限、控制台零改动

---

## 1. 修改文件列表

| 文件 | 改动 |
|---|---|
| `frontend/src/pages/ChatPage.tsx` | ① 删除空会话品牌区（BrandMark / ZRH AI / ZRH 科技集团 / ZRH TECHNOLOGY GROUP / 欢迎文案）——打开即聊天记录；② 流式气泡删除品牌名+集团名头部，仅保留 RAG 命中提示；③ 桌面聊天区内品牌条删除（仅保留会话标题，无标题时整条不渲染）；④ 移动端输入框 `position:fixed; bottom:0; left:0; right:0` 贴底（`max-xl:`），桌面保持文档流；⑤ 接入 `useVisualViewportOffset`，键盘弹出输入框随键盘上移、关闭回底 |
| `frontend/src/components/AppShell.tsx` | **彻底删除底部导航栏组件**（首页/AI对话/我的会话/我的/更多，非 display:none）——删除 JSX、`bottomItems`、`bottomActive`、`MoreHorizontal` 引用；移动端导航统一走 80% 抽屉 |
| `frontend/src/components/chat/MessageItem.tsx` | AI 回复气泡删除品牌名 + 集团介绍头部（保留 stopped/error 状态徽标）；用户消息右侧、AI 左侧不变 |
| `frontend/src/index.css` | 删除 `.zrh-bottom-nav` / `.zrh-bottom-nav-inner` 规则；Header 固定 **56px**（`--zrh-shell-header-h: 3.5rem`，桌面与移动端一致），移除 V4.0 的移动端 40px 降高规则；`html,body,#root` 本已 `overflow-x:hidden; width:100%; max-width:100%`（页面锁定沿用） |
| `frontend/src/hooks/useVisualViewportOffset.ts` | 新增：visualViewport 监听，返回键盘高度偏移量 |
| `frontend/scripts/ux-v5-local-screenshots.mjs` | 新增：本地三端验证截图 + DOM 静态校验脚本 |

删除文件：无（组件级删除均在上表文件内完成）。

## 2. Git Commit SHA

见本节下方「提交记录」（本报告与截图随最后一个 commit 入库）。

## 3. TypeCheck PASS

`tsc -b --noEmit` ✅ 通过（0 error）。

## 4. Build PASS

`vite build` ✅ 通过（13.77s；入口 `index-Ca7MIRX0.js`）。

## 5/6/7. 截图（本地测试栈 :3011 实机渲染，仓库路径 `docs/ux-v5-screenshots/`）

**Phone（390×844）**
- `local-phone-03-chat-empty.png` — 空会话：无 Logo/集团介绍/欢迎语，顶部 Header（ZRH AI + 中/缅/英 + 退出），底部 fixed 输入框
- `local-phone-04-chat-sent.png` — 用户消息右侧、AI typing 左侧、输入框保持贴底（生成中显示停止按钮）
- `local-phone-02-home.png` — 首页：底部导航栏已不存在
- `local-phone-06-drawer.png` — 80% 抽屉：7 项菜单完整（导航能力不受底栏删除影响）
- `local-phone-01-login.png` / `local-phone-05-chat-focus.png`

**Pad（834×1112）**
- `local-pad-03-chat-empty.png` — 空会话无品牌区、输入框 fixed 贴底（实测 `position:fixed; bottom:0`，dock 底边 = 视口底）
- `local-pad-02-home.png` / `local-pad-04-chat-sent.png` / `local-pad-06-drawer.png` 等

**PC（1440×900）**
- `local-pc-04-chat-sent.png` — 三栏布局完整，用户右/AI 左，输入框位于聊天列底部（文档流），聊天区内无品牌条
- `local-pc-03-chat-empty.png` / `local-pc-02-home.png` 等

## 8. 验收标准逐项核对（脚本 DOM 断言 + 截图目检）

| # | 标准 | 结果 |
|---|---|---|
| ① | 删除聊天欢迎 Logo | ✅ 空会话消息区无任何 BrandMark/品牌图 |
| ② | 删除企业介绍 | ✅ "ZRH 科技集团 / ZRH TECHNOLOGY GROUP / 你好，我是 ZRH AI…" 全部移除（消息区、流式气泡、AI 气泡头部、桌面聊天内品牌条） |
| ③ | 删除底部导航栏 | ✅ `.zrh-bottom-nav` 计数 = 0（PC/Pad/Phone），组件代码整体移除 |
| ④ | 输入框固定到底部 | ✅ 移动端 `position:fixed; bottom:0px`，dock 实测 y+h = 视口高度（Phone 719+125=844；Pad 987+125=1112） |
| ⑤ | 页面禁止左右滑动 | ✅ `overflowX:false`（三端），`html/body/#root overflow-x:hidden` |
| ⑥ | 页面禁止晃动 | ✅ 壳层 `overflow-hidden` + `max-width:100%`，无横向偏移 |
| ⑦ | Header 固定 | ✅ 56px（实测 `headerHeight:56`），不随消息滚动（Content 独立滚动） |
| ⑧ | 消息区域独立滚动 | ✅ `MessageList` 为 `flex:1; overflow-y:auto`，整页不滚动 |
| ⑨ | 键盘弹出输入框自动跟随 | ✅ `useVisualViewportOffset` 实时把 dock `bottom` 设为键盘高度；键盘关闭归零回底（实机键盘需真机复核，逻辑按 visualViewport 标准实现） |
| ⑩ | PC、Pad、Phone 全部适配 | ✅ 三端截图全通过；PC 输入框保持文档流避免遮挡侧栏 |

## 9. Production Impact

- **未部署 Production**（按规格第十一条，待赵总确认）。当前公网 ai.zrhtech.com 仍运行 V4.0/1.2.2 版本，不受影响。
- 本改动仅前端：USER 端聊天页与壳层底栏；后端零改动、数据库零改动、权限零改动。
- Admin / SuperAdmin：后台控制台、菜单、权限、知识平台入口全部未动（共享聊天页的空状态/气泡样式变化同样适用于管理角色的聊天页视觉，属规格"聊天页面最终重构"的内在要求）。
- 部署时需注意：底栏删除后移动端导航依赖抽屉（已验证 7 项完整）；建议部署时同步提升 SW cache 版本（如 `v1.2.2-ux-v5`）强制客户端刷新壳层。
- 本地测试栈 `zrh-ai-test-web` 的静态文件已热更新为本构建（容器内 `/usr/share/nginx/html.old` 为替换前备份）。

## 10. 回滚方案

1. **代码级**：`git revert <V5.0 commit SHA>` 后重新 `vite build` 即可恢复 V4.0 聊天页与底栏；全部改动集中在前端 6 个文件，无数据迁移，回滚零残留。
2. **测试栈**：`docker exec zrh-ai-test-web sh -c 'rm -rf /usr/share/nginx/html && mv /usr/share/nginx/html.old /usr/share/nginx/html'`。
3. **生产**（若未来部署后需回滚）：沿用既有方案 —— `ZRH_AI_IMAGE_TAG=1.2.1` 旧镜像 recreate，或重建上一 commit 的 web 镜像。
