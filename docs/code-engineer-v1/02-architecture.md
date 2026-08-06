# ZRH AI Code Engineer V1.0 — Architecture（目标架构）

- **阶段**: Phase 0 方案（设计冻结候选，待赵总审批）
- **基线**: V1.2 Developer Agent（`test/v1.2` @ `ca7424f`）
- **原则**: 本地优先；不依赖任何第三方云端 AI 作为必要运行条件；所有写操作 plan-first；Production 影响为 0

---

## 1. 总体架构（强制分层）

```
┌─────────────────────────────────────────────────────────┐
│  Web (React /developer)  PC · Pad · Phone  中/缅/英       │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS + JWT + PermissionsGuard
┌──────────────────────────▼──────────────────────────────┐
│  zrh-ai-api (NestJS)                                      │
│  Developer Orchestrator ── Planner ── Diff Engine         │
│  Repository Brain ── Code Search ── Auto Test Loop        │
│  Code Review ── Long-Term Memory ── Multi-Agent 协调      │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Policy Engine（新增独立模块，V1.0 核心）           │    │
│  │ RBAC · Workspace ACL · 命令策略 · 路径策略 ·      │    │
│  │ 模型策略 · Token/轮次预算 · 人工闸门规则           │    │
│  └─────────────────────────────────────────────────┘    │
│  AI Gateway（现有）→ 默认本地 Ollama；云端适配器可选默认关闭 │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP + X-Runner-Token（内网）
┌──────────────────────────▼──────────────────────────────┐
│  Isolated Dev Runner（独立容器，非 root，资源限额）          │
│  FS · Search · Terminal(allowlist) · Git · Build/Test     │
│  无 docker.sock · 无生产卷 · 无公网监听 · 最小环境变量       │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Workspace Volume（每 workspace 独立子目录，路径边界强制）    │
└─────────────────────────────────────────────────────────┘
```

**禁止项（架构级，不可被配置打开）**：API 容器挂 docker.sock；Runner 访问生产数据卷/宿主机任意目录/生产密钥；Runner root 运行；Runner 默认公网监听；AI 无确认直接部署。

---

## 2. 模块设计

### A. Repository Brain（Phase 1）

目标：把"正则符号 + 全文 chunk"升级为**结构化仓库理解**。

| 子能力 | 技术方案 | 存储 |
|---|---|---|
| 文件索引（增量） | 以 `dev_code_files.hash` + git status/diff 做变更检测，只重索引变更文件 | `dev_code_files`（扩 `index_status`） |
| AST 解析 | **ts-morph**（TS/JS/TSX，与主栈同语言，API 容器内运行）；Shell/PowerShell/Prisma/SQL/YAML 走轻量解析器 + 正则兜底 | — |
| Symbol 索引 | AST 提取：函数/类/方法/接口/枚举/装饰器/导出，含签名与可见性 | `dev_code_symbols`（扩 `signature, exported, parent`） |
| Import/Export 图 | ts-morph 模块解析 → 有向边 | 新表 `dev_code_edges(from_path,to_path,kind,weight)` |
| Controller→Service→DB | NestJS 装饰器 + Prisma schema 解析 → 分层边 | 同上（kind=`calls/ injects/ persists`） |
| Frontend→API→DTO | 前端 `api/*.ts` fetch 路径 ↔ Nest `@Controller/@Get/...` 路由 ↔ DTO 类 | 同上 |
| Migration 关系 | `prisma/migrations/*` ↔ schema.prisma 模型 | 同上 |
| Test↔源码 | 命名约定 + import 边（`*.spec.ts/e2e` → 被测文件） | 同上 |
| 配置/部署关系 | docker-compose / Dockerfile / nginx.conf 与服务名映射 | 同上 |
| 语义索引 | 保留 embedding 路线，chunk 按 AST 边界切分（函数/类级），升级 `bge-m3` | `dev_code_vectors` |

优先技术栈：TypeScript / JavaScript / React / Vite / NestJS / Prisma / TypeORM / PostgreSQL / Redis / Docker / Nginx / Shell / PowerShell。其中 TS/JS/React/NestJS/Prisma 为一等公民（全 AST），其余为二等（结构化正则 + 注释锚点）。

### B. Code Search（Phase 1–2）

| 能力 | 实现 |
|---|---|
| 精确搜索 | 保留 runner 内容搜索，改走 ripgrep（`rg` 已在 allowlist） |
| 语义搜索 | AST 边界 chunk + bge-m3 + pgvector（现表为 JSON 列，Phase 1 迁 pgvector 或保留应用内余弦作为兜底） |
| Symbol 搜索 | AST 符号表查询（现有 API 不变，数据源升级） |
| 引用查找 / 定义跳转 | import/export 图 + 符号表反查（新增 API `search/references`、`search/definition`） |
| 调用链分析 | 边图 BFS（限深 4），输出路径链 |
| 改动影响分析 | 以变更文件的符号为起点沿边图反向遍历 → 受影响文件/接口/测试清单（Planner 依赖） |

### C. Planner（Phase 2）

严格流程（代码强制，不可跳过）：

```
需求 → 需求澄清(问题清单) → 现状审计(相关文件/符号摘要) → 影响分析(边图)
→ 修改计划(dev_plans) → 风险评估(riskLevel+风险描述) → 回滚方案(必填)
→ 【人工批准】 → 实施
```

- `dev_plans` 扩列：`impact_json`（受影响文件/符号/接口/测试）、`rollback_text`（必填，空则不可批准）、`budget_json`（最大文件数/最大行数）。
- 收到需求直接输出 diff 的路径在 Orchestrator 中被拒绝（现状已是 plan-first，V1.0 增加"澄清/影响/回滚"三必填段）。

### D. Workspace（现状补强）

- 保留多项目/成员 ACL；新增：
  - **文件白名单**：workspace 级 `allow_globs`（默认全部源码扩展名），写操作仅允许白名单内路径。
  - 敏感文件默认禁读清单扩充：`.env*`、私钥（已有）、`*.p12/*.pfx`（已有）、`credentials*`、`*token*`、`backups/`、用户上传目录 `storage/`。
  - 路径边界维持 `resolveWs` 强制；`assertRelativeSafe` 逻辑下沉到 Policy Engine 单一实现（现状 API/runner 两份正则，易漂移）。

### E. Diff Engine（Phase 3）

| 能力 | 设计 |
|---|---|
| 修改前快照 | 新表 `dev_snapshots`（workspace_id, path, sha256, content 或对象存储引用）；apply 前自动快照涉及文件 |
| Unified Diff | 生成与展示均为标准 unified diff（`diff` 库/jsdiff）；存储 `patch` 为标准格式 |
| 应用 | runner 用 `git apply --check` 预检 → `git apply`；上下文不匹配即失败，**禁止静默错写** |
| 接受 / 拒绝 / 部分接受 | 文件级 accept/reject（`dev_diff_files.status`）；hunk 级部分接受 V1.0 选做 |
| 回滚 | 从 `dev_snapshots` 恢复；整 diff 一键 rollback |
| Diff SHA 校验 | apply 前校验当前文件 sha256 == diff 生成时的 base sha，不一致→要求重建 diff |
| Plan 绑定 | 维持强制（现状已实现）；扩散：`dev_diffs.base_sha` |
| 无 Plan 直写 | 继续禁止（架构红线） |

### F. Terminal（Phase 4 前收敛）

- allowlist 按 V1.0 目标收敛为显式命令模板（非裸二进制）：
  - 允许：`npm run typecheck|build|lint|test*`、`npx tsc --noEmit`、`npx eslint`、`npx vitest|jest`、`npx playwright test`、`git status|diff|log`、只读 `prisma` 元数据（`prisma migrate status` 等）。
  - 移除：`docker`（runner 内无 CLI 且不应有）。
- 默认禁止维持并扩充：`rm -rf`、`del /s`、`format`、`mkfs`、`shutdown`、`reboot`、`curl|sh`、`Invoke-Expression`、`node -e`（已禁）、链式命令（已禁元字符）、生产 DB 写入、`docker system prune`、删分支、force push、`reset --hard`、`clean`、防火墙/系统用户修改。
- 危险操作：维持双闸门（owner + confirmed），V1.0 增加"显示命令+影响范围+审计+可回滚"四要素齐全才可确认。
- 资源限制：compose 增加 `cpus/mem_limit/pids_limit`；runner 内每命令超时 + 输出截断（现状已有）。

### G. Git Engineer（Phase 3–4）

- 新增 op：`fetch`、`pull --ff-only`、`branch create/switch`、`push`（非 force，需确认）、PR 准备（生成标题/正文/changed-files 摘要；真正创建 PR 走 GitHub API 为 V1.1+）。
- **commit 改造（P0）**：废除 `git add -A`；只暂存 `dev_diff_files` 已批准路径（精确白名单）；commit 前输出 `git diff --cached` + 文件清单 + 计划关联；commit 后输出 SHA 并存 `dev_git_ops`。
- 默认禁止维持：force push（危险闸门）、rebase 已发布分支、`reset --hard`、`clean`、删远程分支、改历史。

### H. Auto Test Loop（Phase 4）

```
修改 → TypeCheck → Build → Lint → Unit Test → Integration Test → Playwright
→ 错误解析(结构化) → 生成修复计划(新 plan 或子 plan) → 【人工闸门/自动额度内】→ 再次修改 → 重新测试
```

- 错误解析器：tsc/eslint/vitest/playwright 输出 → `{file,line,rule,message}` 结构化（逐工具正则适配）。
- 护栏（Policy Engine 强制，存 `dev_test_runs`）：
  - 最大自动修复轮数：默认 3（验收标准=至少连续 3 轮）
  - 单轮超时 / 总超时（默认 20 min）
  - Token 预算 / 命令次数预算
  - 失败停止条件：同一错误连续 2 轮未变 → 停止并上报
  - 人工闸门：默认第 1 轮修复后需人工确认；可在 workspace 设置中放宽到 3 轮内自动

### I. Code Review（Phase 5）

- 审查器 = 规则引擎（确定性）+ LLM 评审（qwen3:8b / 服务器 32B）双层：
  - 规则层：secret 扫描、`.env` 引用、危险 API（`eval/exec/child_process`）、SQL 拼接、路径拼接、CSRF 豁免点、权限装饰器缺失（`@RequirePermissions`）、多租户过滤缺失。
  - LLM 层：按检查单评审 diff——安全 / 权限 / 多租户隔离 / SQLi / XSS / CSRF / 路径穿越 / 命令注入 / Secret 泄露 / 日志泄露 / Race Condition / Memory Leak / N+1 / 数据精度 / Migration 风险 / 回滚完整性 / 三语言一致性 / 手机响应式。
- 产出 `dev_reviews`（blocking/major/minor 分级）；blocking 未清零不得 apply（Policy Engine 强制）。

### J. Long-Term Project Memory（Phase 6）

- 新表 `dev_project_memory`：`(workspace_id, category, key, content, source, updated_at, updated_by)`；category ∈ 项目规范/架构决策/审批规则/Git 历史摘要/已知 Bug/禁止事项/部署环境/测试命令/回滚方法/品牌规范/三语言规范。
- 约束（架构强制）：每条必带 `source`（文件路径/会话/人工）与 `updated_at`；可按 workspace 隔离与删除；写入前过 secret 扫描，命中即拒。
- 消费：Orchestrator 组 system prompt 时注入相关记忆（按 category 白名单 + 长度预算）。

### K. Multi-Agent（Phase 7，V1.0 仅设计 + 单实例顺序执行）

| 角色 | 职责 | 模型建议 |
|---|---|---|
| Architect Agent | 提出计划、影响分析 | 推理型（r1:8b / 32B） |
| Developer Agent | 写代码、生成 diff | 编码型（qwen2.5-coder） |
| Test Agent | 跑测试、解析错误、提修复建议 | 编码型 |
| Security Reviewer | 安全审查 | 分析型（qwen3） |
| DevOps Agent | 部署诊断（只读） | 分析型 |
| Documentation Agent | 文档/报告 | 通用型 |

- 分工红线：Architect 提计划；Developer 写码；Test 测试；Security Reviewer 审核；**部署批准永远是人（赵总/授权人）**。
- 并发写冲突：V1.0 采用**单写者锁**——同一 workspace 同一时刻只允许一个执行中的 diff（DB 乐观锁 + `dev_diffs.status` 状态机），多 Agent 顺序协作而非并行写。

---

## 3. 模型架构

- 默认全部本地：编码 `qwen2.5-coder:7b`（Phase 1 前置 pull）→ 未来 `qwen2.5-coder:32b`（服务器）；分析 `qwen3:8b`；长上下文分析 `deepseek-r1:8b`；embedding `bge-m3`。
- OpenAI / Anthropic / Gemini / Kimi / Cursor Cloud 适配器保留但**默认关闭**（现状已符合，维持并固化进 Policy Engine：未显式开启的云端 provider 一律拒绝路由）。
- 推理引擎：本机 Ollama；服务器 vLLM/SGLang（provider 已预留接口）。

## 4. 数据架构（新增表汇总）

`dev_code_edges`、`dev_snapshots`、`dev_test_runs`、`dev_reviews`、`dev_project_memory`；扩列：`dev_plans(impact_json, rollback_text, budget_json)`、`dev_diffs(base_sha)`、`dev_diff_files(status, base_sha)`、`dev_code_files(index_status)`、`dev_code_symbols(signature, exported, parent)`。全部新表，**不改动任何现有业务表结构**。

## 5. 部署架构

- V1.0 全周期仅部署 test 栈（`docker-compose.test.yml` 演进为 1.3.0-test）；production compose 不动。
- Phase 8 独立 UAT 栈（克隆 test compose、独立卷/端口）做验收；Phase 10 才做 Production 决策。
