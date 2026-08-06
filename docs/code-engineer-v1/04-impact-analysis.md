# ZRH AI Code Engineer V1.0 — Impact Analysis（影响分析）

- **阶段**: Phase 0 方案
- **分析基线**: `test/v1.2` @ `ca7424f`（工作区干净）

---

## 1. 对现有业务模块的影响（红线核查）

| 模块 | 影响 | 说明 |
|---|---|---|
| Auth / 注册 / 登录 / 邮箱验证码 | **零** | 不改动；仅复用 JWT + PermissionsGuard（只读复用） |
| Mail Center | **零** | 不触碰 |
| Chat | **零** | Developer Orchestrator 为独立模块（现状即如此，P2 架构文档已锁定"不改 Chat 业务模块"） |
| Knowledge / Enterprise RAG | **零** | 仅复用 embedding provider 接口（只读调用）；V1.0 代码向量继续在独立 `dev_code_*` 表 |
| Workflow / Agent / Business Hub | **零** | Phase 7 仅"复用 Agent registry 数据结构"，不改其行为 |
| Admin / Super Admin | **零** | 无管理面变更 |
| Production 数据 | **零** | 全部新表；全部工作在 test/UAT 栈；生产默认不启用 dev-runner（与现状一致） |

**机制保证**：所有新能力落在 `backend/src/developer/**`、`dev-runner/**`、新增 `dev_*` 表、`/developer` 页面——与业务模块物理隔离；Prisma migration 只增不改业务表。

## 2. 数据库影响

| 变更 | 表 | 类型 | 风险 |
|---|---|---|---|
| 新增 | `dev_code_edges`、`dev_snapshots`、`dev_test_runs`、`dev_reviews`、`dev_project_memory` | 全新表 | 低：不影响现有查询 |
| 扩列 | `dev_plans(+impact_json,rollback_text,budget_json)`、`dev_diffs(+base_sha)`、`dev_diff_files(+status,base_sha)`、`dev_code_files(+index_status)`、`dev_code_symbols(+signature,exported,parent)` | 可空扩列 | 低：向后兼容，旧代码可读新表 |
| 权限 seed | developer 权限从 ADMIN 继承剔除、新增授权角色 | 数据变更 | **中：改变 ADMIN 现有行为 → 需赵总显式批准**；seed 幂等可重放 |
| 业务表 | 无 | — | 零 |

所有 migration 先在 test 栈验证，附 down 迁移；UAT 演练回滚。

## 3. API 影响

| 类型 | 端点 | 影响 |
|---|---|---|
| 新增 | `/developer/workspaces/:id/search/references|definition|impact`、`/testloop/run`、`/diffs/:id/rollback`、`/diffs/:id/files/:fileId/accept|reject`、`/diffs/:id/review`、`/memory/*` | 纯增量，无破坏性 |
| 行为增强 | plan approve（缺回滚方案拒批）、diff apply（SHA 校验/快照）、git commit（精确暂存+输出 staged diff/SHA） | **对 Developer 功能内部收紧**，不影响其它模块；对前端有配套更新 |
| 权限 | `api:developer:*` 角色映射调整 | 见 §2 seed 行 |

## 4. UI 影响

- 仅 `/developer` 页面：新增 影响分析 / Test Loop / Review / Memory 面板与逐文件 Diff 视图；`DeveloperPage.tsx` 将按卡片拆分组件（现 483 行单文件）。
- 三语言：新增词条同步 zh-CN / en-US / my-MM；验收含"三语言完整"与"手机响应式"检查（沿用现有断点体系）。
- 其它页面：零改动。

## 5. 基础设施影响

| 项 | 变更 | 风险 |
|---|---|---|
| dev-runner 镜像 | 非 root、allowlist 收敛、`git apply` 支持 | 低，test 栈先行 |
| compose(test) | runner 资源限额（cpus/mem/pids）；UAT 新增独立 compose | 低 |
| compose(production) | **不动**；P10 决策前生产无任何变更 | 零 |
| 卷/网络 | test/UAT 独立；API 与 runner 共享 workspaces 卷问题在 Phase 5 评估拆分（API 改只读挂载或经 runner 读写） | 中低 |
| 本地模型 | `ollama pull qwen2.5-coder:7b`、`bge-m3`（本机/服务器） | 低，可回退 |

## 6. 对现有 Developer Agent 用户的影响

- 行为收紧点：commit 不再 `add -A`（需走 diff 批准路径）；plan 必须填回滚方案；ADMIN 失去 developer 权限（除非被显式授权）。
- 以上三点均需在 Phase 0.5/2/3 上线前以变更说明通知，并纳入审批清单。

## 7. 性能与成本影响

- AST 索引：首建对 ZRH-AI 规模（排除 node_modules 后约数千文件）预计分钟级；增量索引秒级。API 容器内存预算 +512MB。
- Auto Test Loop：受轮数/超时/token 预算硬约束；本地 7B 推理在 RTX 5060 上不影响其它容器（Ollama 在宿主机，GPU 独占使用，与 Docker 容器无资源竞争）。
- 语义索引升级 bge-m3：embedding 耗时略升，可接受。

## 8. 风险与缓解汇总

| 风险 | 等级 | 缓解 |
|---|---|---|
| RBAC 变更引发 ADMIN 投诉 | 中 | 事前审批 + 变更说明 + 显式授权通道 |
| Diff 引擎替换引入新 bug | 中 | `git apply --check` 预检 + 快照 + UAT 真实任务验证 |
| 本地 7B 模型修复成功率不达标 | 中高 | 验收标准按"当前可运行版"分档设定；人工闸门兜底；服务器 32B 为升级路径 |
| Migration 失误 | 低 | 只增不改 + down 迁移 + test/UAT 双验证 |
| 多 Agent 写冲突 | 低 | 单写者锁（DB 状态机） |
