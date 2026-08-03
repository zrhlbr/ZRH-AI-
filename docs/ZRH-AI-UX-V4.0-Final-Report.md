# ZRH AI Enterprise V1.2.2 — UX V4.0 用户端重构 + 生产部署 + 公网验证 最终报告

日期：2026-08-04（Asia/Shanghai）
分支：`test/v1.2`
最终 Git SHA：**`87f1b165e6a04ae8ae4126077b2988845f428da9`**
公网 URL：**https://ai.zrhtech.com**

---

## 1. 交付物总览

| 项目 | 值 |
|---|---|
| 公网 URL | https://ai.zrhtech.com |
| Git SHA | `87f1b165e6a04ae8ae4126077b2988845f428da9`（branch `test/v1.2`） |
| Docker Image Version | `zrh-ai-api:1.2.2`（ID `401a5abe1269`）、`zrh-ai-web:1.2.2`（ID `39eee0c22da5`） |
| Build Version | 1.2.2（`VERSION` 文件；前端 bundle `index-CuR2MuIM.css` / 新哈希 JS） |
| Service Worker Version | Cache：`zrh-ai-shell-v1.2.2-ux-v4.1`；注册 URL `/sw.js?v=1.2.2-ux-v4.1` |
| Manifest | `/manifest.json` 已随新构建重新生成并部署（last-modified 2026-08-03 18:57 UTC） |
| Cloudflare Cache Purge | **未能自动执行（API Token 失效）**，详见第 9 节；边缘已自动 revalidate 新内容 |

## 2. 公网确认结果（①②）

**① 首页已无以下元素**（PC/Pad/Phone 公网截图逐项核对）：
CPU、GPU、Docker、Redis、PostgreSQL、实时状态、统计数字 —— **全部不存在** ✅

首页现仅包含：LOGO（BrandMark）、欢迎语、一句介绍、AI 输入框 + 发送按钮、4 个快捷提示、「查看历史聊天」入口。纯净背景，无 Cosmos/粒子/监控模块。

**② 用户菜单已固定为 7 项**：
首页、AI 对话、我的会话、收藏、我的、设置、退出登录 ✅

以下入口在 USER 角色界面**全部不再出现**：
知识平台、企业RAG、Developer、MCP、Workflow、Business、系统状态 ✅

（ADMIN / SUPER_ADMIN 仍保留知识平台入口与管理控制台，后台功能完整未动。）

## 3. 修改文件清单

**后端**
- `backend/prisma/seed.js` — USER_BASE_PERMISSIONS 精简为 11 项消费者权限；ENTERPRISE 角色显式保留全部企业权限
- `backend/prisma/migrations/20260803120000_ux_v4_user_permission_revoke/migration.sql` — 新增：回收存量 USER/VIP 企业权限
- `backend/scripts/ux-v4-permission-smoke.mjs` — 新增：权限冒烟脚本

**前端**
- `frontend/src/components/AppShell.tsx` — 角色化菜单（USER 固定 7 项）、Drawer `w-[80%]`、语言按钮移入移动端中央组
- `frontend/src/pages/HomePage.tsx` — 重写：纯净首页（去 TechBackground/AiCore/统计）
- `frontend/src/pages/ConversationsPage.tsx` — 新增：我的会话 / 收藏共用页（`favoriteOnly`）
- `frontend/src/main.tsx` — 新增 `/conversations`、`/favorites` 路由
- `frontend/src/components/ChatSidebar.tsx` — 模型状态/统计仅 admin 可见
- `frontend/src/pages/ChatPage.tsx` — PC 聊天区最大宽度 42rem → 60rem（960px，两处）
- `frontend/src/index.css` — 移动 header 2.5rem/2.25rem；**修复 `.zrh-shell-aside` 被强制 `width:100%` 的致命布局 bug（见第 8 节）**
- `frontend/src/i18n/locales/{zh,en,my}.json` — 新增 nav.conversations / nav.favorites / home.intro / home.historyEntry / home.quickPrompt1-4 / conversations.emptyFavorites（三语键一致性脚本校验通过）
- `frontend/public/sw.js` — CACHE 版本提升
- `frontend/src/pwa/install.ts` — SW 注册 URL 版本提升
- `frontend/scripts/ux-v4-public-screenshots.mjs` — 新增：公网 PC/Pad/Phone 截图脚本

## 4. 删除文件清单

- `frontend/frontend/`（误嵌套目录，整目录删除）
- 过期本地截图若干（`docs/ux-v4-screenshots/` 旧批次）
- 诊断临时脚本（未入库）

## 5. Build / TypeCheck / 测试

| 项 | 结果 |
|---|---|
| 前端 `tsc -b --noEmit` | ✅ 通过 |
| 前端 `vite build` | ✅ 通过（16.02s） |
| 后端 `nest build` | ✅ 通过 |
| 权限冒烟（本机测试栈 docker-compose.test） | ✅ **39/39 PASS**：USER 13 企业接口全 403、4 消费者接口 200、ADMIN 全通、匿名 401 |
| 公网生产 API 实测（`ux4prod_*` 纯 USER 账号） | ✅ **16/16 PASS**：12 企业接口全 403、4 消费者接口 200、perms=11 |
| 生产库权限核验 | ✅ USER / VIP 各剩 11 条消费者权限（迁移 + seed 幂等） |
| 横向滚动检测（PC/Pad/Phone） | ✅ 三端均无 `horizontal-overflow` |

## 6. 公网截图（PC / Pad / Phone，全部实机截取于 https://ai.zrhtech.com）

仓库路径：`docs/ux-v4-screenshots/`，共 17 张：

- PC（1440×900）：`public-pc-01-login.png` ~ `public-pc-06-chat.png`
- Pad（834×1112）：`public-pad-01-login.png` ~ `public-pad-06-chat.png`
- Phone（390×844）：`public-phone-01-login.png` ~ `public-phone-06-chat.png`

关键画面：PC 首页（LOGO/欢迎/输入框/快捷提示/历史入口）、Phone/Pad 80% 抽屉（6 项 + 底部退出登录 = 7 项）、我的会话、收藏、AI 对话三栏布局。

## 7. 生产部署过程

1. 源码 tar 同步至 `zrh-admin@192.168.10.74:/home/zrh-admin/zrh-ai`（每次同步前建 `zrh-ai-backup-uxv4-<ts>` 备份）
2. `ZRH_AI_IMAGE_TAG=1.2.2 docker compose -f docker-compose.production.yml --env-file .env build zrh-ai-api zrh-ai-web`
3. `up -d --force-recreate` → 容器全部 healthy
4. entrypoint 自动执行 `prisma migrate deploy` + `seed`（USER 权限回收幂等生效）
5. 第二轮（CSS 修复）：仅重建 `zrh-ai-web`，recreate 后公网即时生效

## 8. 部署后发现并修复的问题（重要）

**现象**：首次部署后 PC 端所有登录后页面主区域空白（Phone 正常）。
**根因**：`index.css` 的「禁止横向拖动」规则把 `.zrh-shell-aside` 与壳层一起设为 `width:100%`。非 layered 作者样式优先级高于 Tailwind utilities，覆盖了桌面侧栏的 `w-56`，侧栏被撑到 1440px 全宽，主内容被挤到视口右侧外（`main` rect x=1440, w=0）。DOM 内容存在但视觉不可见。
**修复**：`.zrh-shell-aside` 移出 `width:100%` 组，仅保留 `max-width:100%; overflow-x:hidden`。同时把 SW cache 提升为 `v1.2.2-ux-v4.1`，强制已安装客户端抛弃旧缓存壳。
**验证**：修复后 PC/Pad/Phone 三端 17 张公网截图全部正常渲染。

## 9. Cloudflare Cache Purge 结果（如实说明）

**自动 Purge 未执行成功**：Cloudflare MCP 返回 `1000: Invalid API Token`（凭据失效），本机与生产服务器均无 `CLOUDFLARE_API_TOKEN` / `ZONE_ID` 可用凭据。

**但公网内容已确认为最新，不依赖 purge**：
- `/`（HTML）：`cf-cache-status: DYNAMIC` —— 边缘从不缓存 HTML，每次回源
- `/sw.js`：边缘已 `REVALIDATED`，当前服务内容即 `zrh-ai-shell-v1.2.2-ux-v4.1`
- 静态 JS/CSS：文件名为内容哈希（如 `index-CuR2MuIM.css`），新构建即新 URL，无旧缓存污染问题
- `/manifest.json`：`DYNAMIC` + 新 last-modified

**如需赵总手动 purge（可选，双保险）**：
1. Cloudflare Dashboard → zrhtech.com → Caching → Configuration → **Purge Everything**；或
2. 在本机配置 `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ZONE_ID` 后运行 `scripts/purge-cf-brand-cache.ps1`

**浏览器端 SW 旧缓存**：新 SW（v4.1）安装时会删除全部旧 cache 并 `clients.claim()`，用户下次打开自动生效；等不及可硬刷新（Ctrl+Shift+R）或 DevTools → Application → Storage → Clear site data。

## 10. Production Impact

- **用户可见**：USER/VIP 界面彻底消费者化；企业入口消失；企业 API 返回 403（前端 + 后端双重收口）
- **数据**：迁移仅删除 USER/VIP 角色的企业权限映射，不触碰用户/会话/消息数据；ENTERPRISE/ADMIN/SUPER_ADMIN 权限不变
- **兼容**：SW 版本升级自动替换旧缓存；PWA manifest 不变更 id，已安装用户无需重装
- **验证账号**：生产库留有 `ux4prod_*` / `ux4pub_*` / `ux4diag_*` 验证账号，可由 admin 在后台删除

## 11. 回滚方案

1. **快速回滚（镜像级）**：远程旧镜像仍在 —— `ZRH_AI_IMAGE_TAG=1.2.1 docker compose -f docker-compose.production.yml --env-file .env up -d --force-recreate zrh-ai-api zrh-ai-web`（`zrh-ai-api:1.2.1` / `zrh-ai-web:1.2.1` 未删除）
2. **源码回滚**：远程备份目录 `zrh-ai-backup-uxv4-<ts>`；或 `git revert 87f1b16 1a4d1be 3b2ccec` 后重新走部署流程
3. **数据库回滚**：权限迁移只删不增，回滚代码后重跑 seed 不会自动恢复已回收的 USER 企业权限（符合安全预期）；如需恢复，在 seed 中临时放开对应权限后执行一次 seed 即可

## 12. 已知遗留

- Cloudflare API Token 失效，自动 purge 无法闭环（见第 9 节，不影响内容 freshness）
- 远程 admin 账号登录未在本次验证范围内（仅验证了 USER 角色全链路）
- 大 chunk（ChatPage 646KB）存在 vite 体积告警，属优化项非缺陷
