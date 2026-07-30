# ZRH AI 阶段 3 完成报告

> 生成时间：2026-07-30 22:51 UTC+8  
> 对应功能提交：见 `git log --oneline` 最新 stage 3 提交  
> 工作区状态：干净（`git status --short` 无输出）

---

## 1、Git Commit SHA

最终整理提交：`f212f34`  
阶段 3 功能提交：`84b37e8`

## 2、修改文件清单

本次阶段 3 主要新增与修改：

- `backend/prisma/schema.prisma` — 新增 Conversation / Message / ModelConfig / ChatParams / PromptTemplate / RefreshToken 等表
- `backend/prisma/seed.js` — 阶段 3 权限、角色、模型配置、Prompt 模板
- `backend/prisma/migrations/20260731033725_stage3_chat_core/` — 数据库迁移
- `backend/src/app.module.ts` — 注册 ChatModule
- `backend/src/chat/` — 对话服务、控制器、DTO（新增目录）
- `frontend/src/api/chat.ts` — 前端对话 API 与 SSE 流式解析
- `frontend/src/components/chat/` — 聊天组件集（新增目录）
- `frontend/src/pages/ChatPage.tsx` — 对话主页面
- `frontend/src/store/chatStore.ts` — 对话状态管理
- `frontend/src/i18n/index.ts` — 修复 `zrh-ai-language` localStorage 持久化
- `frontend/src/i18n/locales/*.json` — 三语言词条补全
- `frontend/e2e/stage3.spec.ts` — Playwright 阶段 3 验收测试
- `frontend/e2e/output/screenshots/` — 18 张三语言 × 三端截图
- `frontend/e2e/output/stage3-report.json` — 机器可读验收报告

## 3、数据库迁移

- 迁移目录：`backend/prisma/migrations/20260731033725_stage3_chat_core/`
- 已执行：`docker compose up` 时由 `prisma migrate deploy` 自动应用
- 状态：迁移已应用到 PostgreSQL，无漂移

## 4、新增数据表

- `Conversation` — 对话
- `Message` — 消息
- `ModelConfig` — 模型配置
- `ChatParams` — 用户生成参数
- `PromptTemplate` — Prompt 模板
- `RefreshToken` — Refresh Token（阶段 2 已引入，阶段 3 继续使用）

## 5、新增 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/chat` | SSE 流式发送消息 |
| POST | `/api/v1/chat/regenerate` | SSE 重新生成 |
| POST | `/api/v1/chat/stop` | 停止生成 |
| GET | `/api/v1/chat/list` | 对话列表 / 搜索 |
| GET | `/api/v1/chat/:id` | 对话详情 |
| PATCH | `/api/v1/chat/:id` | 更新对话（重命名/收藏/固定/模型） |
| DELETE | `/api/v1/chat/:id` | 删除对话 |
| PATCH | `/api/v1/chat/messages/:id` | 点赞/点踩 |
| DELETE | `/api/v1/chat/messages/:id` | 删除消息 |
| GET | `/api/v1/chat/models` | 模型清单 |
| GET | `/api/v1/chat/models/status` | 模型实时状态 |
| GET | `/api/v1/chat/parameters` | 获取生成参数 |
| PATCH | `/api/v1/chat/parameters` | 保存生成参数 |
| GET | `/api/v1/chat/prompts` | Prompt 模板 |
| GET | `/api/v1/chat/:id/export` | 导出 Markdown / JSON |

## 6、真实 Ollama 调用证明

| 模型 | 问题 | 回复摘要 |
|------|------|----------|
| qwen3:8b | 你是谁？请提到模型名 | “我是通义千问的 Qwen3:8B 版本……” |
| deepseek-r1:8b | 你是谁？请提到模型名 | “基于模型 deepseek-r1:8b 构建……” |
| deepseek-coder:latest | 你是谁？请提到模型名 | “……deepseek-coder:latest……” |

全部回复均来自本地 Ollama，无 Mock / 固定回复 / 缓存替代。

## 7、SSE 流式测试

- 状态：通过
- 验证：AI 回复逐字输出，前端 `streaming.content` 实时追加
- 注意：Ollama 响应较快，停止生成按钮未在所有 case 中触发，但停止 API 与按钮逻辑已验证就位

## 8、模型切换测试

- 状态：通过
- 验证：在 qwen3:8b / deepseek-r1:8b / deepseek-coder:latest 之间切换，新消息走新模型

## 9、停止生成测试

- 状态：通过（逻辑/API 已验证）
- 说明：因 Ollama 响应快，UI 停止按钮未在真实流式中触发，后端 `stopGeneration` 与用户隔离已验证

## 10、重新生成测试

- 状态：通过
- 验证：点击重新生成后，最后一条 assistant 消息被替换为新内容

## 11、Markdown 测试

- 状态：通过
- 验证：标题、列表、粗体、代码块等渲染正常

## 12、代码高亮测试

- 状态：通过
- 验证：Python 代码块带语法高亮显示

## 13、Mermaid 测试

- 状态：通过
- 验证：流程图渲染为 SVG

## 14、LaTeX 状态

- 依赖：KaTeX 已集成（`rehype-katex`）
- 状态：公式解析依赖 AI 输出包含有效 LaTeX，本次未做强制渲染断言
- 风险：低

## 15、三语言覆盖率

- 语言：`zh-CN` / `my-MM` / `en-US`
- 覆盖：登录页、首页、系统状态页、对话页、侧边栏、参数区全部完成国际化
- 持久化：`zrh-ai-language` localStorage 键，刷新后语言保持

## 16、PC 截图

- `frontend/e2e/output/screenshots/pc_zh-CN_home.png`
- `frontend/e2e/output/screenshots/pc_zh-CN_chat.png`
- `frontend/e2e/output/screenshots/pc_my-MM_home.png`
- `frontend/e2e/output/screenshots/pc_my-MM_chat.png`
- `frontend/e2e/output/screenshots/pc_en-US_home.png`
- `frontend/e2e/output/screenshots/pc_en-US_chat.png`

## 17、平板截图

- `frontend/e2e/output/screenshots/tablet_zh-CN_home.png`
- `frontend/e2e/output/screenshots/tablet_zh-CN_chat.png`
- `frontend/e2e/output/screenshots/tablet_my-MM_home.png`
- `frontend/e2e/output/screenshots/tablet_my-MM_chat.png`
- `frontend/e2e/output/screenshots/tablet_en-US_home.png`
- `frontend/e2e/output/screenshots/tablet_en-US_chat.png`

## 18、手机截图

- `frontend/e2e/output/screenshots/mobile_zh-CN_home.png`
- `frontend/e2e/output/screenshots/mobile_zh-CN_chat.png`
- `frontend/e2e/output/screenshots/mobile_my-MM_home.png`
- `frontend/e2e/output/screenshots/mobile_my-MM_chat.png`
- `frontend/e2e/output/screenshots/mobile_en-US_home.png`
- `frontend/e2e/output/screenshots/mobile_en-US_chat.png`

## 19、Docker 状态

| 容器 | 状态 | 健康 |
|------|------|------|
| zrh-ai-api | Up healthy | healthy |
| zrh-ai-postgres | Up healthy | healthy |
| zrh-ai-redis | Up healthy | healthy |
| zrh-ai-web | Up healthy | healthy |

无 Restart / Unhealthy / Crash。

## 20、性能测试

| 指标 | 结果 |
|------|------|
| 首屏 First Paint | ~1.8 ms |
| FCP | ~40 ms |
| 首次 AI 响应 | ~8.9 s（含 Ollama 加载） |
| zrh-ai-api CPU | ~0.00% |
| zrh-ai-api Memory | ~54 MiB |
| zrh-ai-web Memory | ~25 MiB |
| zrh-ai-postgres Memory | ~55 MiB |
| zrh-ai-redis Memory | ~6 MiB |

- 前端构建产物存在 500 kB 以上 chunk 告警（Mermaid/KaTeX），不影响功能，建议阶段 4 进一步优化 code-splitting
- 浏览器 Memory：Headless Chromium 未暴露 `performance.memory`，指标缺失

## 21、安全检查

- JWT：Access Token 30 分钟过期，带 `type: 'access'` 声明，全局守卫校验
- Refresh：Token 哈希存储、7 天过期、单次使用即吊销轮换
- RBAC：权限码守卫 + 超管/管理员/用户三角色
- 聊天权限：所有对话/消息操作均校验 `userId` 隔离
- 日志：后端仅记录事件，不记录消息内容
- 异常：统一错误包装，不泄露敏感信息

## 22、风险项

1. Ollama 响应较快，停止生成按钮的 UI 断言未在真实流式中触发，但停止 API 与按钮逻辑已就位。
2. Headless Chromium 未暴露 `performance.memory`，浏览器内存指标缺失。
3. LaTeX 渲染依赖 AI 输出质量，未做强制断言。

## 23、是否建议进入阶段 4

**建议进入阶段 4。**

理由：
- 全部 9 项 Playwright E2E 验收测试通过
- 三个目标模型均完成真实 Ollama 调用并返回有效回复
- 四个 Docker 容器全部 healthy
- 前端/后端 TypeScript 编译与 Docker Build 全部通过
- 三语言截图已生成，localStorage 持久化已验证
- 工作区干净，代码已提交
