# ZRH AI

本地私有化 AI 平台 — 阶段 1 项目骨架。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + React Router + Zustand + i18next + Framer Motion + Lucide |
| 后端 | NestJS + TypeScript + Prisma + PostgreSQL + Redis |
| 模型 | Ollama (qwen3:8b / deepseek-r1:8b / deepseek-coder:latest) |
| 部署 | Docker Compose |

## 端口规划

| 服务 | 宿主机端口 | 容器端口 |
|------|-----------|---------|
| 前端 zrh-ai-web | 3010 | 80 |
| 后端 zrh-ai-api | 4010 | 4010 |
| PostgreSQL zrh-ai-postgres | 5440 | 5432 |
| Redis zrh-ai-redis | 6380 | 6379 |
| Ollama (宿主机) | 11434 | — |

## 快速开始

```powershell
# 1. 配置环境变量
Copy-Item .env.example .env   # 然后编辑 .env 填入真实密码

# 2. 启动全部服务
.\scripts\start.ps1

# 3. 查看状态 / 日志 / 停止
.\scripts\status.ps1
.\scripts\logs.ps1
.\scripts\stop.ps1
```

或使用 Docker Compose 直接操作：

```bash
docker-compose up -d --build
```

## 验证入口

- 前端: http://localhost:3010
- 后端健康检查: http://localhost:4010/api/health
- Ollama 状态: http://localhost:4010/api/ollama/health
- Ollama 模型: http://localhost:4010/api/ollama/models

## 国际化

三语架构从阶段 1 建立：`zh-CN` / `my-MM` / `en-US`，语言文件位于 `frontend/src/i18n/locales/`，三份文件键结构完全一致。缅文字体预留 `Noto Sans Myanmar`。

## 隔离承诺

本项目所有容器使用 `zrh-ai-` 统一前缀、独立网络 `zrh-ai-network`、独立数据卷，不连接、不修改任何现有 ZRH 容器与 Open WebUI。
