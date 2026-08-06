# ZRH AI Code Engineer V1.0 — Development Plan（分阶段实施计划）

- **阶段**: Phase 0 方案（待审批冻结）
- **总原则**: 每阶段仅动 `developer` / `dev-runner` / 新增模块；不触碰 Auth / 注册 / 登录 / 邮箱验证码 / Mail Center / Chat / Knowledge / Enterprise RAG / Workflow / Agent / Business Hub / Admin / Super Admin / Production 数据。
- **工作量单位**: 人日（pd），按 1 名全栈 + 1 名评审估算。

---

## Phase 0 — 现状审计与方案冻结（本阶段）

- **目标**: 22 项审计、架构/计划/影响/安全/测试/回滚/分工/审批 9 份文档冻结
- **修改模块**: 无（仅文档，且文档先存工作区，审批后入 `docs/code-engineer-v1/`）
- **DB / API / UI 影响**: 无
- **安全风险**: 无
- **验收标准**: 9 份文档齐备；审计证据可复核（文件:行号）
- **回滚方式**: 不适用
- **工作量**: 已完成（约 1 pd）
- **赵总审批**: ✅ 必需（进入 Phase 1 的闸门）

## Phase 0.5 — 安全前置修复（建议插入，1–2 pd）

- **目标**: 先清 P0/P1 安全项再建能力
- **修改模块**: `dev-runner/Dockerfile`（非 root USER）、`docker-compose.test.yml`（cpus/mem/pids 限额）、`seed.js` RBAC（developer 权限从 ADMIN 继承中剔除，新增授权机制）、`dev-runner` allowlist 移除 `docker`
- **DB 影响**: seed 重跑（权限表 upsert，无结构变更）
- **API / UI 影响**: 无
- **安全风险**: 降低（修复 root 运行、ADMIN 越权面）
- **验收标准**: runner `whoami` ≠ root；超限容器被限速；ADMIN 访问 `/api/v1/developer/*` 返回 403；授权角色正常
- **回滚方式**: 镜像回退 1.2.0-test；seed 幂等可重放
- **赵总审批**: ✅（RBAC 变更涉及现有角色行为）

## Phase 1 — Repository Brain（5–8 pd）

- **目标**: AST 符号索引、import/export 边图、增量索引、语义索引升级
- **修改模块**: 新增 `backend/src/developer/brain/`（ast-parser、edge-builder、incremental-indexer）；改 `code-index.service.ts`；runner 无改动
- **DB 影响**: 新表 `dev_code_edges`；扩列 `dev_code_files.index_status`、`dev_code_symbols.(signature,exported,parent)`；新 migration（test 栈先行）
- **API 影响**: 新增 `search/references`、`search/definition`、`search/impact`；现有 API 不变
- **UI 影响**: Developer 页加"影响分析"面板（复用现有卡片风格，三语言词条新增）
- **安全风险**: 解析器资源消耗 → 索引任务限并发 1、限 500 文件起步
- **验收标准**: 对 ZRH-AI 自身仓库完成索引；可回答"此函数被谁引用""此 Controller 依赖哪些 Service/表"；增量索引只处理变更文件
- **回滚方式**: 新表 drop；`code-index.service` 回退 git 版本；migration 有 down
- **赵总审批**: 阶段启动审批 + 上线 test 审批

## Phase 2 — Planner 与影响分析（3–4 pd）

- **目标**: 计划强制含 澄清/审计/影响/风险/回滚 五段；影响分析由边图自动产出
- **修改模块**: `plan.service.ts`、`orchestrator.service.ts`（prompt 与流程状态机）、新增 impact-analyzer
- **DB 影响**: `dev_plans` 扩 `impact_json/rollback_text/budget_json`
- **API 影响**: plan create/approve 校验增强（缺回滚方案不可批准）
- **UI 影响**: Plan 卡片展示五段结构 + 影响文件清单
- **安全风险**: 影响分析错误 → 误导实施；以"边图证据 + 文件清单"形式呈现供人核对
- **验收标准**: 无回滚方案的 plan 无法 approve；影响清单与实际改动文件重合率 ≥ 80%（抽 5 个真实任务）
- **回滚方式**: 扩列可空兼容，回退代码即可
- **赵总审批**: 阶段验收

## Phase 3 — 安全多文件 Diff（5–6 pd）

- **目标**: 真 unified diff、修改前快照、SHA 校验、部分接受、一键回滚、**废除 git add -A**
- **修改模块**: `diff.service.ts`、runner `/fs/apply-patch`（改 `git apply --check`→`git apply`）、`git-write.service.ts` + runner `/git`（精确暂存）
- **DB 影响**: 新表 `dev_snapshots`；扩 `dev_diffs.base_sha`、`dev_diff_files.(status,base_sha)`
- **API 影响**: diff 新增 file 级 accept/reject、rollback 端点；commit 输出 staged diff + 文件清单 + SHA
- **UI 影响**: Diff 面板逐文件 diff 视图（unified 渲染）+ 接受/拒绝/回滚按钮
- **安全风险**: apply 写错 → `git apply --check` 预检 + SHA 不一致即拒绝；commit 夹带 → 白名单暂存
- **验收标准**: 大文件增量修改不再整文件覆盖；上下文漂移时 apply 失败而非错写；commit 仅含批准文件；任意 diff 可一键回滚到快照
- **回滚方式**: 快照本身即回滚机制；代码回退 git 版本
- **赵总审批**: 阶段验收（含 git 行为变更说明）

## Phase 4 — Auto Test Loop（4–6 pd）

- **目标**: 修改→TypeCheck→Build→Lint→Unit→Integration→Playwright→错误解析→修复计划 闭环 + 全套护栏
- **修改模块**: 新增 `backend/src/developer/testloop/`（runner 编排、错误解析器、预算控制）；terminal allowlist 收敛为命令模板
- **DB 影响**: 新表 `dev_test_runs`（每轮命令/结果/错误结构/轮次）
- **API 影响**: 新增 `POST workspaces/:id/testloop/run`、状态查询
- **UI 影响**: Test Loop 面板（轮次时间线 + 错误列表 + 闸门按钮）
- **安全风险**: 自动循环失控 → 轮数/超时/token/命令四层预算 + 同错误停滞即停 + 默认人工闸门
- **验收标准**: 对注入的 3 个真实 bug 连续完成 ≥3 轮自动修复（或到达闸门）；超预算即停并留审计
- **回滚方式**: 功能开关关闭即回到手动流程
- **赵总审批**: 阶段验收

## Phase 5 — Code Review（3–4 pd）

- **目标**: 规则引擎 + LLM 双层评审，blocking 清零才可 apply
- **修改模块**: 新增 `backend/src/developer/review/`（规则集 + LLM 评审编排）；`diff.service` 接入闸门；顺带修复审计 ip 接线
- **DB 影响**: 新表 `dev_reviews`
- **API 影响**: `POST diffs/:id/review`、review 结果查询
- **UI 影响**: Review 面板（分级清单 + 驳回理由）
- **安全风险**: LLM 漏报 → 确定性规则层兜底高危项（secret/.env/权限装饰器/SQL 拼接）
- **验收标准**: 对含注入/secret/越权样本 diff 检出率 100%（规则层）；评审报告中文/缅文/英文可切换
- **回滚方式**: 闸门可配置回退为"仅提示不阻断"
- **赵总审批**: 阶段验收

## Phase 6 — Long-Term Project Memory（2–3 pd）

- **目标**: 项目记忆表 + 注入编排 + 管理界面
- **修改模块**: 新增 `backend/src/developer/memory/`；Orchestrator prompt 组装接入
- **DB 影响**: 新表 `dev_project_memory`
- **API 影响**: CRUD + 审计；写前 secret 扫描
- **UI 影响**: Memory 管理卡片（分类/来源/更新时间/删除）
- **安全风险**: 记忆污染 → source 必填 + 按 workspace 隔离 + secret 扫描拦截
- **验收标准**: 记忆可追溯（来源/时间/操作人）、可删除、跨 workspace 不串；不含任何密钥（扫描验证）
- **回滚方式**: 注入开关关闭
- **赵总审批**: 阶段验收

## Phase 7 — Multi-Agent 协作（4–6 pd，V1.0 范围内=角色编排+单写者锁）

- **目标**: 六角色定义、顺序协作编排、单写者锁防并发写
- **修改模块**: 新增 `backend/src/developer/multiagent/`；复用 Agent Center registry；Orchestrator 支持角色链
- **DB 影响**: `dev_sessions` 扩 `agent_chain_json`；复用现有表
- **API 影响**: 会话创建可选角色链
- **UI 影响**: 对话流中显示角色署名
- **安全风险**: 多 Agent 写冲突 → 单写者锁（DB 状态机强制）；部署决策不出让（永远人工）
- **验收标准**: 同一 workspace 并发两写会话时后者排队/拒绝；完整走通 Architect→Developer→Test→Security Reviewer 链一次真实小需求
- **回滚方式**: 角色链功能开关
- **赵总审批**: 阶段验收

## Phase 8 — 独立测试环境 UAT（3–5 pd）

- **目标**: 独立 UAT 栈完成 V1.0 验收标准 20 条 + 真实任务验收
- **修改模块**: 新增 `docker-compose.uat.yml`（克隆 test、独立卷/端口）；验收脚本 `scripts/accept-code-engineer-v1.sh`
- **DB/API/UI 影响**: 无新变更（冻结后验证）
- **安全风险**: UAT 与 test/prod 串扰 → 独立网络/卷/端口，端口绑 127.0.0.1
- **验收标准**: 验收标准 1–20 全过；真实任务（前端 bug、后端 bug、小型全栈需求、建测试、Build 通过、Commit 正确、完整报告）全过
- **回滚方式**: UAT 栈整体删除
- **赵总审批**: ✅ UAT 报告签收

## Phase 9 — RC 候选（1–2 pd）

- **目标**: 文档齐备、镜像定版 `1.3.0-rc`、UAT 复测
- **修改模块**: 版本号、CHANGELOG、运维手册
- **验收标准**: RC 在 UAT 栈复测通过；回滚演练通过（回退 1.2.2 镜像 + 数据无损验证）
- **赵总审批**: ✅

## Phase 10 — Production 决策（会议）

- **目标**: 赵总依据 RC 报告决策：合并 main / 打 tag / 生产发布窗口 / 生产 runner 是否启用
- **前置硬条件**: 验收 20 条全过；回滚演练记录；安全模型复核；Production 影响评估 = 0 的部署方案（默认生产不启用 dev-runner，与现状一致）
- **赵总审批**: ✅✅（最终决策权）

---

## 里程碑汇总

| 阶段 | 工作量 | 累计 | 审批点 |
|---|---|---|---|
| P0 | 1 | 1 | 进入 P1 |
| P0.5 | 1–2 | 2–3 | RBAC 变更 |
| P1 | 5–8 | 7–11 | 上线 test |
| P2 | 3–4 | 10–15 | 验收 |
| P3 | 5–6 | 15–21 | 验收 |
| P4 | 4–6 | 19–27 | 验收 |
| P5 | 3–4 | 22–31 | 验收 |
| P6 | 2–3 | 24–34 | 验收 |
| P7 | 4–6 | 28–40 | 验收 |
| P8 | 3–5 | 31–45 | UAT 签收 |
| P9 | 1–2 | 32–47 | RC |
| P10 | 会议 | — | 最终决策 |

**总计约 32–47 人日**（不含等待审批时间）。
