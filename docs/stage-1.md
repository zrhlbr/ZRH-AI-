# ZRH AI 阶段 1 — 项目骨架说明

## 范围

本阶段仅交付项目骨架：Git 仓库、前端/后端基础框架、Docker Compose 编排、健康检查链路、三语基础架构。不包含登录、聊天、知识库、RAG、Agent 或完整监控页面。

## 架构

```
浏览器 → zrh-ai-web (nginx, :3010)
            ├─ /          → 静态前端 (React SPA)
            └─ /api/*     → zrh-ai-api (NestJS, :4010)
                                ├─ /api/health         → 聚合健康检查
                                ├─ /api/ollama/health  → Ollama 探活（代理）
                                ├─ /api/ollama/models  → 模型清单（代理）
                                ├─ zrh-ai-postgres (:5432, 宿主机 5440)
                                ├─ zrh-ai-redis    (:6379, 宿主机 6380)
                                └─ Ollama          (host.docker.internal:11434)
```

前端代码只使用相对路径 `/api`，绝不直接访问 `localhost:11434`。

## 目录

| 路径 | 说明 |
|------|------|
| `frontend/` | React + TS + Vite + Tailwind 前端 |
| `backend/` | NestJS + Prisma 后端 |
| `docker/` | 预留：后续阶段的辅助镜像/配置 |
| `scripts/` | start / stop / status / logs PowerShell 脚本 |
| `storage/` | 运行期文件存储（gitignore） |
| `backups/` | 备份输出（gitignore） |
| `logs/` | 本地日志（gitignore） |

## 三语架构

- 语言文件：`frontend/src/i18n/locales/{zh-CN,my-MM,en-US}.json`，键结构完全一致
- 持久化：`i18next-browser-languagedetector` 写入 localStorage 键 `zrh-ai-language`，刷新后保持
- 缅文字体：`Noto Sans Myanmar` 已在 `index.css` 与 Tailwind 字体栈中预留，`html[lang='my-MM']` 自动切换

## 新增界面文本规范

禁止在 React 组件中硬编码界面文本。新增文本时：

1. 在三份 locale JSON 的相同位置添加相同键
2. 组件内通过 `t('...')` 引用
3. 提交前人工核对三份文件键集合一致
