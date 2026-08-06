# ZRH AI Code Engineer V1.0 — Current State Audit（现状审计）

- **阶段**: Phase 0（只读审计，未修改任何源码 / 数据库 / Git 历史）
- **审计时间**: 2026-08-06
- **项目路径**: `C:\Users\zhaor\ZRH-AI`
- **当前分支**: `test/v1.2`
- **当前 HEAD**: `ca7424f6f444a14660c0210cb0e07016a6cead7b`
- **工作区状态**: 干净（`git status --porcelain` = 0 个未提交文件）

---

## 0. 环境基线（实测）

| 项目 | 实测值 | 证据 |
|---|---|---|
| Production 栈 | `zrh-ai-api:1.2.2` / `zrh-ai-web:1.2.2` + postgres:16 + redis:7，Up 41h healthy | `docker ps` |
| Production dev-runner | **未运行**（production compose 中已定义服务但当前未启动容器） | `docker ps` |
| Test 栈 | `zrh-ai-test-api/web/dev-runner/postgres/redis`，镜像 `1.2.0-test`，Up 41h healthy | `docker ps` |
| Test 端口暴露 | API `127.0.0.1:4011→4010`，仅 loopback | `docker-compose.test.yml` |
| 本机硬件 | Lenovo 83LV；Ryzen 9 8945HX（16C/32T）；32 GB RAM；RTX 5060 Laptop（8 GB GDDR7）+ Radeon 610M 核显 | WMI（WMI 显存字段 32bit 截断显示 4 GB，实际 8 GB） |
| 本机 Ollama 模型 | `qwen3:8b`(Q4_K_M, ctx 40k)、`deepseek-r1:8b`(Q4_K_M, ctx 131k)、`deepseek-coder:latest`(**1B** Q4_0, ctx 16k)、`nomic-embed-text`(137M, embedding) | `GET /api/tags` |

---

## 1. 22 项能力审计总表

状态标记：COMPLETE / PARTIAL / PLACEHOLDER / MISSING / UNSAFE / BLOCKED

| # | 能力 | 状态 | 关键证据 | 主要缺口 |
|---|---|---|---|---|
| 1 | DeveloperModule | **COMPLETE** | `backend/src/developer/` 13 个服务 + controller + module，全部接线 | — |
| 2 | Developer Workspace | **COMPLETE** | `workspace.service.ts`：多 workspace、bind/git 两种、slug、成员 ACL（viewer/editor/owner） | 无 per-workspace 文件白名单；敏感文件清单可再扩充 |
| 3 | Dev Runner | **PARTIAL** | `dev-runner/src/server.js`（456 行）：独立容器、Token 认证、不挂 docker.sock、默认绑 127.0.0.1、独立 volume | Dockerfile 无 `USER` 指令→**容器内 root 运行**；compose 无 CPU/内存/PID 限制；allowlist 含 `docker` 但容器内无 docker CLI（死条目） |
| 4 | Plan / Diff | **PARTIAL** | plan-first 已强制（diff 必须有 approved plan，`diff.service.ts:29-38`）；delete 需逐文件二次确认 | patch 应用是"取所有 `+` 行"的朴素实现，**非真正 unified diff**；无修改前快照；无部分接受；无 Diff SHA 校验；无回滚 |
| 5 | File Tree | **COMPLETE** | runner `treeWalk`：排除 node_modules/.git/dist/.env，深度 6 | UI 仅展示前 300 个文件 |
| 6 | Code Editor | **PLACEHOLDER** | `DeveloperPage.tsx` 用只读 `<pre>` 展示文件 | 无 Monaco/编辑组件；无语法高亮；写入只经 Diff Apply |
| 7 | Repository Search | **PARTIAL** | 文件名搜索、内容子串搜索（400 文件上限）、正则符号索引、Ollama embedding 语义搜索（800 行内存余弦 + 词法兜底） | 无 AST；无 import/export 图；无引用查找/定义跳转/调用链；符号提取为正则（`SYMBOL_RE`）非 AST |
| 8 | Terminal | **COMPLETE** | allowlist + denylist 双层、禁 shell 元字符、`shell:false` spawn、超时、输出 redact、审计落库、拒绝返回 403 | allowlist 与 V1.0 目标命令集（typecheck/build/lint/test/Playwright）需显式收敛；`docker` 死条目 |
| 9 | Git | **PARTIAL + UNSAFE 点** | 读：status/diff/log/branches；写：commit/revert；危险操作（reset-hard/clean/push-force）需 owner + confirmed | **commit 内部执行 `git add -A`**（`server.js:406`）→ 违反"精确暂存白名单/无无关文件夹带"；无正常 push/fetch/pull/branch；无 PR 准备 |
| 10 | MCP | **PARTIAL** | `mcp/`：registry/session/health/logs 完整；种子含 gitlab/mysql/redis/ollama/web_search/browser 等 | 服务器多为"预留 stub"，未与 dev-runner 工具面打通 |
| 11 | Model Router | **COMPLETE** | `model-router.service.ts`：manual 优先 + 关键词 auto + 默认兜底；`parseModelRef` 已修复 Ollama tag 冒号误判 | 关键词路由较粗（V1.0 可接受） |
| 12 | CursorCloudProvider | **COMPLETE（符合要求）** | `cursor-cloud.provider.ts`：官方 API 适配器，`CURSOR_CLOUD_ENABLED` 默认 false，DB `dev_provider_settings` 默认 disabled | —（符合"可选适配器默认关闭"） |
| 13 | Local Coder Provider | **PARTIAL** | Ollama provider 完整（generate/stream/stop/health）；Orchestrator 默认 `ollama:deepseek-coder:latest` | **本机 deepseek-coder 实为 1B Q4_0**，代码能力不足以承担 Code Engineer 主模型（详见本地模型审计） |
| 14 | Audit Logs | **COMPLETE** | `DevAuditLog`（workspace/plan/diff/terminal/git/session 全量）+ `DevTerminalRun` + `DevGitOp`；内容 redact | `ip` 字段未接线（始终空） |
| 15 | RBAC | **PARTIAL** | `seed.js`：5 个 developer 权限；USER/VIP 完全无 developer 权限（PermissionsGuard 403） | **ADMIN 继承除 superadmin 外全部权限 → ADMIN 当前拥有全部 developer 权限**，与验收标准 15（USER/ADMIN 无 Developer 权限）冲突；ENTERPRISE 有 read/chat/write 但无 terminal/admin |
| 16 | Workspace ACL | **COMPLETE** | `assertAccess`：成员表 + owner 兜底 + 角色等级（viewer<editor<owner），SUPER_ADMIN 旁路 | — |
| 17 | Command Allowlist | **COMPLETE** | runner `COMMAND_ALLOW`/`COMMAND_DENY` + API 侧 `assertCommandSafe` 双层 | 见 #8；denylist 未含 PowerShell `Invoke-Expression`（Windows 场景）、`node -e` 已禁 |
| 18 | Dangerous Operation Confirmation | **COMPLETE** | git 危险操作：owner 角色 + `confirmed=true` 双闸门，未确认记 `denied` 并 403；diff delete 逐文件确认；terminal 危险旁路已整体禁用 | UI 确认是 `window.confirm`（V1.0 建议改为显式二次输入确认） |
| 19 | Docker Isolation | **PARTIAL** | 无 docker.sock；独立 network/volume；`expose` 而非 `ports`；test/prod 完全分栈 | runner 容器 root 运行；无资源限制（cpu/mem/pids）；test 栈 `RUNNER_BIND=0.0.0.0`（依赖 network 隔离）；API 容器与 runner 共享 workspaces volume（API 理论可绕开 runner 直接写） |
| 20 | GitHub Remote | **PARTIAL** | workspace `kind=git` 支持 https/git@ clone（depth 1，URL 校验） | 无 push（仅危险 push-force）、无 fetch/pull、无 GitHub API/PR 集成 |
| 21 | Test Stack | **COMPLETE** | `docker-compose.test.yml` 五容器全部 healthy，独立 DB `zrh_ai_test`、独立网络/卷/端口 | — |
| 22 | Production Isolation | **COMPLETE** | prod 跑 1.2.2 且无 dev-runner 容器；P2 架构文档明确"production compose 默认 1.1.0 系、runner 仅 test 线"；test/prod 数据卷分离 | 需在 V1.0 各阶段持续验证（见 Rollback Plan） |

**统计**：COMPLETE 11 · PARTIAL 8 · PLACEHOLDER 1 · UNSAFE 点 2（runner root、git add -A）· MISSING 0 · BLOCKED 0

---

## 2. 子系统详查

### 2.1 Plan → Diff → Apply 链路（现状）

```
chat(planMode) → LLM 输出 ```plan JSON``` → dev_plans(pending)
→ approve(plan) → materializeDiffFromPlan → 逐 step 调 LLM 生成整文件 → dev_diffs(pending)
→ approve(diff) →（delete 文件需 confirmDelete）→ apply → runner /fs/apply-patch 写盘
```

- 优点：plan-first 已由代码强制（无 planId 或 plan 未 approved 直接 400）；全链路审计。
- 缺口：
  1. `apply-patch` 的 patch 解析是"过滤 `+` 行"的朴素算法，上下文错位不会失败 → **可能静默写错内容**。
  2. apply 前无快照/备份 → 无法回滚单次 apply。
  3. 无 Diff SHA：runner `/fs/write` 会算 sha256 但未被校验/存库。
  4. 无部分接受（file 级 accept/reject）。
  5. LLM 生成的是"整文件内容"，不是增量 diff，长文件易截断（现有 `existing.slice(0, 8000)` 上限）。

### 2.2 索引与搜索（现状）

- `dev_code_files / dev_code_symbols / dev_code_vectors` 三表；rebuild 上限 500 文件、每文件 8 chunk × 1200 字符、符号上限 200/文件。
- 符号提取为正则（function/class/const/let/var/interface/type/enum），不支持方法、装饰器、import/export。
- 语义搜索：Ollama `nomic-embed-text`（经 knowledge 模块 embedding provider），应用内余弦，>0.15 阈值，词法兜底。
- **无**：AST（tree-sitter/ts-morph）、import/export 关系、Controller→Service→DB 链、Frontend→API→DTO 链、Migration 关系、Test↔源码关系、增量索引（rebuild 是全量 delete+insert）。

### 2.3 Terminal 沙箱（现状）

- 双层校验：API `assertCommandSafe`（禁元字符/force push/reset --hard/clean）+ runner `allowCommand`（allowlist 正则 + denylist + eval 逃逸检测：`node -e`、包管理器 `-e`、`find -exec` 均禁）。
- 执行：`spawn(argv, shell:false)`，最小环境变量（不含 DEV_RUNNER_TOKEN），默认 60s、硬上限 120s，stdout/stderr 各截断 200KB，输出 redact 后落 `dev_terminal_runs`。
- `allowDangerous` 在 API 层恒为 false，runner 收到 true 也拒绝并提示走 git/dangerous API → 设计正确。

### 2.4 RBAC 现状矩阵

| 角色 | menu | read | chat | write | terminal | admin |
|---|---|---|---|---|---|---|
| SUPER_ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓（继承全量） |
| ENTERPRISE | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| USER / VIP | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

- **与验收标准 15 的偏差**：标准 USER/ADMIN 无 Developer 权限、仅授权角色可用。当前 ADMIN 全量继承。
- 建议：V1.0 引入独立角色（如 `DEVELOPER` / `DEV_LEAD`）或将 developer 权限从 ADMIN 继承中剔除并显式授予（见 Development Plan Phase 0.5 / Security Model）。

### 2.5 前端 Developer 工作台（现状）

`frontend/src/pages/DeveloperPage.tsx`（483 行）：项目列表 / 文件树 / 只读文件视图 / Agent 对话（SSE）/ Plan 审批 / Diff 审批与 Apply / Terminal / Git（commit + 危险操作下拉）/ 语义搜索 / 审计历史。响应式（`lg:` 断点双栏）。三语言词条 `developer.*` 已存在于 zh-CN / en-US / my-MM。

### 2.6 MCP / Agent / Tools 复用面

- MCP Gateway：registry + session + health + logs；目标 connector（gitlab/mysql/redis/ollama/web_search/browser）为预留 stub。
- Agent Center：通用 Agent registry/runtime/memory/skills，可供 V1.0 Multi-Agent 角色复用，但目前无"代码工程师"角色定义、无并发写冲突控制。
- Tool Center：内置 `code_execute`（受限表达式）、`calculator` 等，与 dev-runner 无关。

---

## 3. 本地模型审计（实测，不夸大）

### 3.1 已安装模型

| 模型 | 参数 | 量化 | 上下文 | 代码能力评估 |
|---|---|---|---|---|
| qwen3:8b | 8.2B | Q4_K_M | 40,960 | 通用强、支持 tools/thinking；代码中等，可作分析/评审引擎 |
| deepseek-r1:8b | 8.2B | Q4_K_M | 131,072 | 推理链长、慢；适合复杂分析，不适合交互式编码 |
| deepseek-coder:latest | **1B** | Q4_0 | 16,384 | **不足以做 Code Engineer 主模型**：多文件改动、unified diff 生成、长上下文修复循环均不可靠 |
| nomic-embed-text | 137M | F16 | 2,048 | 仅 embedding，索引可用 |

**结论：当前"编码引擎"默认值 `ollama:deepseek-coder:latest` 是全链路最薄弱环节。**

### 3.2 硬件可运行规模（本机：32GB RAM + RTX 5060 Laptop 8GB）

| 档位 | 可行性 | 预期 |
|---|---|---|
| 7B–8B Q4_K_M | ✅ GPU 全载（~5.2GB VRAM） | 30–60 tok/s，交互可用 |
| 13B–14B Q4 | ⚠️ 部分 offload（~9GB > 8GB VRAM） | 8–15 tok/s，可接受批处理 |
| 32B Q4 | ⚠️ CPU+内存推理（~19GB） | 2–5 tok/s，仅离线任务 |
| 70B | ❌ 本机不可行 | — |
| CPU 纯推理 8B | ✅ 可用 | 5–10 tok/s |

### 3.3 两档推荐

**A. 当前可运行版（本机/普通 PC）**
- 主编码模型：`qwen2.5-coder:7b` Q4_K_M（代码专项，明显优于 deepseek-coder 1B；需 `ollama pull`，Phase 1 前置）
- 分析/评审：`qwen3:8b`（已有）；长文档分析：`deepseek-r1:8b`（已有，慎用速度）
- Embedding：`nomic-embed-text`（已有）→ 建议升级 `bge-m3`（多语言，中/英/缅更稳）
- 推理引擎：Ollama（现状），保留 vLLM/SGLang provider 适配器（已存在）供服务器版
- 现实预期：单文件 bug 修复、小功能、测试生成**可用**；大型重构、跨多文件精确 unified diff、连续 3+ 轮自动修复**不稳定**——Auto Test Loop 必须配人工闸门

**B. 未来增强版（ZRH 云服务器）**
- 建议配置：1× 24GB GPU（RTX 4090/ A5000 级）跑 `qwen2.5-coder:32b` Q4_K_M；或 2× 24GB 跑 70B Q4
- 引擎：vLLM/SGLang（provider 已预留），并发多会话
- 上下文：32k–128k（配合 Repository Brain 检索而非全文塞入）

### 3.4 代码正确率预期（如实）

| 任务 | 7B–8B 本地 | 32B 服务器 |
|---|---|---|
| 单文件小 bug | 60–75% 一次通过 | 80–90% |
| 多文件小功能 | 40–60% 需 2–3 轮 | 70–85% |
| 精确 unified diff（大文件） | 不可靠 → 必须整文件或 AST 辅助 | 基本可用 |
| 连续 3 轮自动修复闭环 | 需严格错误解析+闸门，成功率有限 | 可达成验收标准 |

---

## 4. P0 / P1 / P2 风险登记

| 级别 | 风险 | 位置 | 处置 |
|---|---|---|---|
| **P0** | runner 容器以 root 运行 | `dev-runner/Dockerfile` 无 USER | Phase 1 前修复：非 root 用户 + 资源限制 |
| **P0** | git commit 走 `git add -A`，会夹带无关文件 | `dev-runner/src/server.js:406` | Phase 3：精确暂存白名单 + staged diff 输出 |
| **P0** | 主编码模型为 1B，无法支撑验收任务 | Orchestrator `pickModelRef` | Phase 1 前置：切换 qwen2.5-coder:7b |
| **P1** | patch 朴素应用可能静默错写 | runner `/fs/apply-patch` | Phase 3：真 unified diff + SHA 校验 + 快照 |
| **P1** | ADMIN 拥有全部 developer 权限 | `seed.js` ROLE_PERMISSIONS | Phase 0.5：权限模型调整（需赵总审批） |
| **P1** | apply 无快照、不可回滚 | `diff.service.ts` | Phase 3：修改前快照表 |
| **P2** | 符号索引为正则、无 AST/依赖图 | `code-index.service.ts` | Phase 1：Repository Brain |
| **P2** | API 与 runner 共享 workspaces volume | compose | Phase 5 安全加固：API 不直挂可写卷 |
| **P2** | MCP connector 均为 stub | mcp registry | Phase 7 后按需启用 |
| **P2** | 审计日志 ip 未接线 | `audit.service.ts` | Phase 5 顺带修复 |

---

## 5. 审计结论

V1.2 Developer Agent 已具备**正确的骨架**：plan-first 强制、双层命令沙箱、危险操作双闸门、全量审计、workspace ACL、test/prod 分栈，且这些机制是代码强制而非文档声明。距离 Code Engineer V1.0 的差距集中在四点：**Repository Brain（AST/依赖图）、真 Diff Engine（快照/SHA/部分接受/回滚）、Auto Test Loop（缺失）、本地编码模型太弱（1B）**。无 BLOCKED 项，建议进入 Phase 1（详见 Approval Checklist）。
