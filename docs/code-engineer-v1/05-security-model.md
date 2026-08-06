# ZRH AI Code Engineer V1.0 — Security Model（安全模型）

- **阶段**: Phase 0 方案
- **现状基线**: V1.2 已具备的安全机制见《Current State Audit》§1；本文件定义 V1.0 目标态

---

## 1. 安全分层（强制，不可配置关闭）

```
Web/API → Developer Orchestrator → Policy Engine → Isolated Dev Runner → Workspace
```

- **Policy Engine**（Phase 1 落地为独立模块，合并现有 `SecurityPolicyService` 与 runner 内重复逻辑为单一事实源）：RBAC、Workspace ACL、命令策略、路径策略、模型路由策略、预算、人工闸门。
- API 与 runner 的策略规则**同源分发**（现状两份正则易漂移，列为 P2 修复）。

## 2. Runner 隔离（目标态）

| 控制项 | 现状 | V1.0 目标 |
|---|---|---|
| docker.sock | 未挂载 ✅ | 维持（架构红线） |
| 生产数据卷 | 未挂载 ✅ | 维持 |
| 宿主机目录 | 仅 workspaces 卷 ✅ | 维持；API 容器改只读挂载或取消直挂（Phase 5） |
| 运行用户 | **root（P0）** | 非 root（`USER node` + 卷权限修复） |
| 网络 | 内网 expose ✅ | 维持；`RUNNER_BIND=0.0.0.0` 仅限容器网络，文档化 |
| 公网监听 | 无 ✅ | 维持 |
| 资源限制 | **无（P0）** | compose: `cpus: "2.0"`、`mem_limit: 2g`、`pids_limit: 256` |
| 生产密钥 | 最小 env，不含 runner token ✅ | 维持；env 白名单化 |
| 命令执行 | `shell:false` + argv ✅ | 维持 |

## 3. 命令策略

**允许（模板化，Phase 4 收敛）**：typecheck / build / lint / unit test / integration test / Playwright / `git status|diff|log` / 只读 DB 元数据（`prisma migrate status` 等）。

**默认禁止（denylist，命中即 403 + 审计）**：`rm -rf`、`del /s`、`format`、`mkfs`、`shutdown`、`reboot`、`curl|sh`、`wget|sh`、`Invoke-Expression`、`node -e`/`--eval`（已禁）、包管理器 eval（已禁）、`find -exec`（已禁）、shell 元字符与链式命令（已禁）、生产数据库写入、`docker system prune`、删除 Git 分支、force push、`reset --hard`、`clean`、修改防火墙、修改系统用户。

**危险操作四要素**（缺一不得执行）：二次确认（UI 显式确认，非 window.confirm 一句带过）→ 明确显示命令 → 显示影响范围 → 审计日志 + 可回滚路径。

## 4. 文件与路径策略

- 路径边界：`resolveWs` 强制（现状 ✅）；`..`/绝对路径拒绝（现状 ✅）。
- 默认禁读扩充：`.env*`（已有）、私钥/`*.pem/*.key/*.p12/*.pfx`（已有）、`id_rsa`/`.ssh`（已有）、`credentials*`、`*token*`、`backups/`、用户上传敏感目录 `storage/uploads/`。
- 写白名单：workspace 级 `allow_globs`（默认 `src/**`、配置扩展名白名单），写操作越名单即拒。
- 读取内容 redact（secret 正则 + Bearer，现状 ✅）维持；索引 chunk 同样 redact（现状 ✅）。

## 5. Git 策略

- commit：精确暂存白名单（仅批准的 diff 文件清单），**废除 `git add -A`**；输出 staged diff + 文件清单 + Commit SHA 并落库。
- 禁止默认：force push / rebase 已发布分支 / reset --hard / clean / 删远程分支 / 改历史；其中 reset-hard/clean/push-force 维持 owner+confirmed 双闸门（现状 ✅）。
- 新增 push（非 force）需确认；PR 仅生成准备材料，不自动创建。

## 6. 权限模型（V1.0 目标，需审批）

| 角色 | developer 权限 |
|---|---|
| SUPER_ADMIN | 全部 |
| 新增 `DEVELOPER`（或显式授权） | read/chat/write/terminal |
| 新增 `DEV_LEAD` | + admin（workspace 创建、危险操作确认） |
| ADMIN | **无（从继承中剔除）**——验收标准 15 |
| ENTERPRISE | 无（现状 read/chat/write 收回，统一走授权角色） |
| USER / VIP | 无（现状 ✅） |

配套：授权由 SUPER_ADMIN 在用户管理面授予；所有授权/收回写审计日志。

## 7. AI 使用边界

- 本地模型为唯一必要依赖；云端 provider（OpenAI/Anthropic/Gemini/Kimi/Cursor Cloud）适配器默认关闭，启用需 SUPER_ADMIN 显式开启并记审计（现状机制保留并固化进 Policy Engine）。
- AI 不得：无 plan 写文件（现状 ✅ 代码强制）、无确认执行危险操作、直接部署（无此能力）、读取/回显 `.env`（现状 ✅ 多层拦截 + 输出 redact）。
- Prompt 注入防御：仓库文件内容进入上下文前视为不可信数据；检索片段统一包裹标记；LLM 输出的命令仍需过同一 allowlist（不存在"LLM 直连 runner"通道——所有执行经 Terminal/Diff API）。

## 8. 审计与可追溯

- 全操作落 `dev_audit_logs`（现状 ✅）；V1.0 补齐 `ip` 接线。
- Diff 链路四重证据：plan（含影响/回滚）→ diff（base_sha）→ snapshot → apply/rollback 记录。
- Auto Test Loop 每轮命令/输出/决策落 `dev_test_runs`。
- Memory 每条带 source/updated_at/updated_by；secret 扫描命中即拒写。

## 9. 多租户与数据隔离

- workspace 成员 ACL（viewer/editor/owner）现状 ✅；V1.0 增加 session 归属校验（现状已有）+ 跨 workspace 记忆隔离。
- test / UAT / prod 三栈网络、卷、数据库完全分离；生产默认无 dev-runner。

## 10. 验收安全条款（对应总验收标准）

| # | 条款 | 验证方式 |
|---|---|---|
| 12 | 不读取 .env | 渗透用例：直接读/索引/搜索/对话诱导四路测试 |
| 13 | 不越出 Workspace | 路径穿越用例集（`..`、绝对路径、符号链接） |
| 14 | 危险命令无确认返回 403 | 逐条 denylist 用例 |
| 15 | USER/ADMIN 无 Developer 权限 | 权限矩阵自动化测试 |
| 16 | 仅授权角色可用 | 同上 |
| 17 | 全操作审计 | 抽查 20 类操作留痕完整 |
| 20 | Production 影响为 0 | 部署清单比对 + 生产容器/数据校验 |
