# ZRH AI 阶段 2 — 认证与基础架构

## 范围

企业级平台基础：统一设计系统、视觉升级、品牌统一、登录页、统一组件、JWT + Refresh Token + RBAC、三语 100% 同步、系统监控接口、/api/v1 统一规范、三主题、响应式、安全底座。不含知识库 / Agent / 完整聊天 / RAG / 完整监控页。

## 后端

### 统一规范

- 全部接口位于 `/api/v1/`（URI Versioning）
- 成功返回：`{ code: 0, message: "ok", data, timestamp }`（TransformInterceptor）
- 异常返回：`{ code: <http>, message, data: null, timestamp }`（AllExceptionsFilter）
- 统一请求日志：LoggingInterceptor（方法/路径/状态码/耗时）
- 全局 ValidationPipe（whitelist + forbidNonWhitelisted）

### 认证与 RBAC

| 机制 | 实现 |
|------|------|
| 登录 | POST /api/v1/auth/login（bcryptjs 校验） |
| Access Token | JWT，30 分钟，全局 JwtAuthGuard 校验 |
| Refresh Token | 48 字节随机，sha256 存库，7 天，登录元数据记录 UA/IP |
| 轮换 | POST /api/v1/auth/refresh：旧 token 吊销 + 签发新对 |
| 注销 | POST /api/v1/auth/logout：吊销 refresh token |
| RBAC | Role(SUPER_ADMIN/ADMIN/USER) ↔ Permission(MENU/BUTTON/API) |
| 权限中间件 | PermissionsGuard + @RequirePermissions('api:...') |
| 公开接口 | @Public()：health / login / refresh / logout |

### 接口清单（13 个）

| 路径 | 鉴权 |
|------|------|
| GET /api/v1/health | 公开 |
| POST /api/v1/auth/login | 公开 |
| POST /api/v1/auth/refresh | 公开 |
| POST /api/v1/auth/logout | 公开 |
| GET /api/v1/auth/profile | api:auth:profile |
| GET /api/v1/ollama/health | api:ollama:read |
| GET /api/v1/ollama/models | api:ollama:read |
| GET /api/v1/system/cpu | api:system:cpu |
| GET /api/v1/system/memory | api:system:memory |
| GET /api/v1/system/gpu | api:system:gpu |
| GET /api/v1/system/network | api:system:network |
| GET /api/v1/system/storage | api:system:storage |
| GET /api/v1/system/docker | api:system:docker |

> GPU：容器内无 nvidia-smi，如实返回 `available:false`，阶段 4 经宿主机 agent 扩展。
> Docker：只读挂载 docker.sock 调 `/_ping` + `/version`，不操作任何容器。

### 数据库

- 迁移：`prisma/migrations/*stage2_auth_rbac`（容器入口 migrate deploy）
- 种子：`prisma/seed.js` 幂等（12 权限 / 3 角色 / 超管）
- 模型：User / Role / Permission / RolePermission / RefreshToken / SystemMeta

## 前端

### 设计系统 `src/design-system/`

colors / spacing / typography / radius / shadows / animations / icons / breakpoints / theme —— 九模块统一出口 `designSystem`，三主题（black-gold 默认 / deep-space-blue / midnight-black）经 `applyThemeToDom()` 写 CSS 变量，zustand persist 持久化。

### 统一组件 `src/components/ui/`

ZButton / ZInput / ZCard / ZModal / ZBadge / ZTable / ZTabs / ZDialog（8 个）。

### 视觉

- 科技背景：TechBackground = 科技网格 + 粒子数据流 + 可选数字地球（Canvas 2D，DPR 自适应，标签页隐藏暂停）
- 基元类：`.zrh-glass` 毛玻璃 / `.zrh-glow-border` 微光边框 / `.zrh-hud` HUD 角标 / `.zrh-tech-grid` 网格
- 品牌：ZRH AI / ZRH / Local Private AI Platform / © ZRH Technology（design-system/theme.ts brand 常量，不翻译）

### 页面

- `/login`：左数字地球 + 右管理员登录（移动端单栏）
- `/`：中央 AI 输入区（阶段 3 开放对话）+ 右侧实时状态（CPU/GPU/Memory/Docker/Redis/PostgreSQL/Ollama/Models，10s 轮询）
- `/status`：系统状态卡片 + 模型表（ZTable）
- 路由守卫：RequireAuth（无 token → /login）；RedirectIfAuthed 等待 profile 就绪后才跳转，保证菜单/按钮权限判断基于完整资料

### 三语

- 51 键 × zh-CN / my-MM / en-US，键结构脚本校验一致
- localStorage `zrh-ai-language` 持久化，刷新保持
- 缅文自动应用 Noto Sans Myanmar
- 禁止硬编码界面文本（CI 级 grep 校验通过）
