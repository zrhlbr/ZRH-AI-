# ZRH AI Stage 3.5 安全复查报告

**项目：** ZRH AI（NestJS 后端 + React/Vite 前端）  
**复查日期：** 2026-07-31  
**范围：** `backend/src/**`、`frontend/src/**`、Prisma schema、Docker/nginx 配置、`.env.example`

---

## 1. JWT 实现

**评级：需要注意**

- 使用 `@nestjs/jwt` 默认 `HS256`；未显式配置 `algorithm`。
- `JWT_SECRET` 缺失时回退到硬编码开发密钥 `zrh-ai-dev-secret`（`backend/src/auth/auth.module.ts:10`）。
- Access Token TTL 30 分钟，合理。
- `JwtAuthGuard` 验证 token 类型为 `access`，并重新查询 DB 校验用户状态，权限变更即时生效。
- Token 存储在 `localStorage`（XSS 可窃取，但天然 CSRF 免疫）。

| # | 发现 | 位置 | 风险 |
|---|---|---|---|
| 1.1 | 生产环境硬编码 fallback JWT 密钥 | `backend/src/auth/auth.module.ts:10` | **高** |
| 1.2 | 未显式指定签名算法 | `backend/src/auth/auth.module.ts:8-11` | 低 |
| 1.3 | Access Token 存储在 localStorage | `frontend/src/store/authStore.ts:24-35` | 中 |

**建议：** 移除 fallback 密钥，启动时若 `JWT_SECRET` 缺失则直接失败；考虑缩短 token 有效期。

---

## 2. Refresh Token 实现

**评级：需要注意**

- 使用 `randomBytes(48)` 生成，熵充足。
- 仅存储 SHA-256 哈希，原始 token 不持久化。
- 每次刷新后撤销旧令牌并发放新对，已实现 rotation。
- **缺失刷新令牌复用检测**：被盗令牌在合法用户刷新前被使用时，攻击者可获得有效新对；无 token family 失效机制。
- Refresh Token 通过 JSON body 传输并存储在 localStorage。
- `logout()` 按 hash 撤销但未校验令牌归属。

| # | 发现 | 位置 | 风险 |
|---|---|---|---|
| 2.1 | 无 refresh-token 复用/家族失效检测 | `backend/src/auth/auth.service.ts:78-95` | **高** |
| 2.2 | Refresh Token 在响应体/localStorage 中传输 | `backend/src/auth/auth.service.ts:52-57` | **高** |
| 2.3 | `logout()` 未校验 token 归属 | `backend/src/auth/auth.service.ts:97-103` | 低 |

**建议：** 增加 token family 跟踪，复用已撤销令牌时整族失效；Refresh Token 改用 `httpOnly, Secure, SameSite=Strict` Cookie。

---

## 3. RBAC 与权限检查

**评级：通过**

- 全局注册 `JwtAuthGuard` + `PermissionsGuard`。
- `@Public()` 正确排除登录、刷新、登出、健康检查。
- `@RequirePermissions(...)` 与 guard 配合正常。
- 每次请求从 DB 加载权限，权限变更即时生效。
- `SUPER_ADMIN` 拥有全部权限，无危险 `isAdmin` 绕过。

---

## 4. SQL 注入防护

**评级：通过**

- 全部使用 Prisma 查询构造器。
- 唯一 raw query 为 `SELECT 1` 静态字面量，无用户输入。
- ID 参数使用 `ParseIntPipe` 转换。
- 搜索使用 Prisma `contains` + `mode: 'insensitive'`。

---

## 5. XSS 防护

**评级：需要注意**

- React 默认转义用户消息内容。
- `react-markdown` 输出 React 元素，未使用 `dangerouslySetInnerHTML`。
- Mermaid SVG 通过 `ref.current.innerHTML = svg` 注入（`MarkdownRenderer.tsx:24`）；虽设置 `securityLevel: 'strict'`，但 `innerHTML` 仍是 DOM-XSS  sink。
- 外链仅使用 `rel="noreferrer"`，未显式加 `noopener`。

| # | 发现 | 位置 | 风险 |
|---|---|---|---|
| 5.1 | Mermaid SVG 通过 innerHTML 注入 | `frontend/src/components/chat/MarkdownRenderer.tsx:24` | 中 |
| 5.2 | 外链未显式设置 noopener | `frontend/src/components/chat/MarkdownRenderer.tsx:144` | 低 |

**建议：** Mermaid SVG 注入前用 DOMPurify 消毒；外链增加 `noopener`；部署 CSP。

---

## 6. CSRF 防护

**评级：通过（当前设计）**

- 认证使用 `Authorization: Bearer` 头，非 Cookie，无 SameSite 攻击面。
- CORS 在 `main.ts:18-22` 配置白名单 `WEB_ORIGIN` + `credentials: true`。

---

## 7. Prompt Injection

**评级：需要注意**

- System Prompt 作为独立 `role: 'system'` 消息，历史作为 `role: 'user'` 发送，基本分离存在。
- `UpdateConversationDto.systemPrompt` 允许用户完全覆盖会话系统提示（设计如此，但削弱指令边界）。
- 无 delimiter、无 jailbreak 过滤、无输出审核层。

| # | 发现 | 位置 | 风险 |
|---|---|---|---|
| 7.1 | 用户可完全覆盖 system prompt | `backend/src/chat/dto/chat.dto.ts:126-129` | 中 |
| 7.2 | 无 prompt/output 过滤或审核层 | `backend/src/chat/chat.service.ts:431-499` | 中 |

**建议：** 区分不可变的开发者指令与用户可编辑上下文；增加关键词/越狱前缀拦截。

---

## 8. 日志与敏感信息脱敏

**评级：通过**

- `LoggingInterceptor` 仅记录方法、URL、状态码、耗时，不记录 body/query/header。
- 登录成功记录用户名/角色，失败仅记录用户名，密码永不记录。
- Chat service 仅记录事件，不记录消息内容。
- Refresh Token 原始值永不记录，仅存储 SHA-256 哈希。
- 异常响应可能泄露 Ollama 错误细节（路径/主机名）。

| # | 发现 | 位置 | 风险 |
|---|---|---|---|
| 8.1 | 错误响应可能泄露后端细节 | `backend/src/common/filters/all-exceptions.filter.ts:22-41` | 低 |

**建议：** 生产环境对客户端返回通用错误信息，完整错误仅服务端日志记录。

---

## 9. 安全头、限流、输入校验

**评级：需要注意**

- 全局 `ValidationPipe` 开启 `whitelist`、`transform`、`forbidNonWhitelisted`，DTO 使用 class-validator，强。
- **无速率限制**：未安装 `@nestjs/throttler`，无 nginx `limit_req`，登录接口可被暴力破解。
- **无安全头**：未使用 helmet，无 HSTS、X-Frame-Options、X-Content-Type-Options、CSP。
- 密码策略：仅要求非空，最长 128，无最小长度。
- Docker socket 以 read-only 挂载到后端容器。

| # | 发现 | 位置 | 风险 |
|---|---|---|---|
| 9.1 | 无速率限制/暴力破解防护 | `backend/src/main.ts` | **高** |
| 9.2 | 无安全头 | `backend/src/main.ts`、`frontend/nginx.conf` | **高** |
| 9.3 | 无最小密码长度 | `backend/src/auth/dto/auth.dto.ts:9-12` | 中 |
| 9.4 | Docker socket 暴露给后端容器（read-only） | `docker-compose.yml:86` | 低/中 |

**建议：** 安装 `@nestjs/throttler` 并严格限制 `/auth/login`、`/auth/refresh`；后端加 helmet，nginx 配置 CSP 等安全头；密码最小 8-12 位。

---

## 10. 聊天权限隔离

**评级：通过**

所有聊天端点均同时校验 API 权限与 `userId` 所有权：

- `listConversations`、`getConversation`、`updateConversation`、`deleteConversation` 均带 `where: { userId }`。
- `updateMessage` / `deleteMessage` 通过 `conversation: { userId }` 校验。
- `exportConversation`、`stream` 均校验 `conversation.findFirst({ id, userId })`。

未发现横向权限提升漏洞；用户无法访问他人对话、消息或导出内容。

---

## 11. 其他发现

| # | 发现 | 位置 | 风险 |
|---|---|---|---|
| A.1 | 默认 `ADMIN_INITIAL_PASSWORD` 可能为空 | `docker-compose.yml:81` | **高**（部署配置） |
| A.2 | Seed 未强制密码复杂度 | `backend/prisma/seed.js:146-162` | 中 |
| A.3 | PostgreSQL 不可用时应用仍启动 | `backend/src/prisma/prisma.service.ts:26-34` | 低 |
| A.4 | Auth token 通过 zustand persist 写入 localStorage | `frontend/src/store/authStore.ts:23-35` | 中 |

---

## 12. 优先级整改清单

1. **移除硬编码 JWT fallback 密钥**，缺失时启动失败。
2. **增加速率限制**，重点保护认证接口。
3. **增加安全头**（helmet + nginx CSP/HSTS/X-Frame-Options）。
4. **实现 refresh-token 复用检测 / token family 失效**。
5. **将 refresh token 迁移至 httpOnly, Secure, SameSite=Strict Cookie**。
6. **Mermaid SVG 注入前消毒**，外链加 `noopener`。
7. **强制密码最小长度**，并确保生产环境 `ADMIN_INITIAL_PASSWORD` 非空。
