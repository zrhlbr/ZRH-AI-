# ZRH AI Code Engineer V1.0 — Test Plan（测试方案）

- **阶段**: Phase 0 方案
- **环境**: test 栈（开发期）→ 独立 UAT 栈（Phase 8 验收期）；Production 不参与任何测试

---

## 1. 测试分层

| 层 | 工具 | 范围 |
|---|---|---|
| 后端单测 | Jest（NestJS 现有体系） | developer 各服务、Policy Engine、Diff Engine、错误解析器 |
| runner 单测 | node:test | allowlist/denylist、路径边界、patch 应用、git op |
| 集成测试 | test 栈 + supertest | API 全链路（plan→diff→apply→commit）、权限矩阵、审计留痕 |
| E2E | Playwright（frontend/e2e 现有体系扩展） | /developer 全流程、三语言、移动断点 |
| 渗透/安全用例 | 手工 + 脚本 | 路径穿越、.env 四路读取、命令注入、denylist 全覆盖 |
| 真实任务验收 | 人工驱动 AI | 见 §4 |

## 2. 各阶段测试要点

- **Phase 1（Repository Brain）**：AST 符号/边图准确性抽样（50 个符号人工核对）；增量索引正确性（改动 1 文件只重索引该文件及其边）；引用查找召回率 ≥ 90%（对 ZRH-AI 自身抽样）。
- **Phase 2（Planner）**：无回滚方案 plan 拒批；影响清单重合率 ≥ 80%（5 个真实任务）。
- **Phase 3（Diff Engine）**：上下文漂移时 `git apply --check` 拦截；SHA 不一致拒 apply；快照回滚字节级一致；部分接受只写被接受文件；commit 不含白名单外文件（构造夹带用例）。
- **Phase 4（Auto Test Loop）**：注入 3 个 bug 各跑通闭环；轮数/超时/token/命令预算四项各越界一次验证停止；同错误两轮未变自动停止；闸门未确认不进入下一轮写。
- **Phase 5（Review）**：规则层对 20 个高危样本（secret/SQLi/越权/路径穿越/命令注入）检出率 100%；blocking 未清零时 apply 被拒。
- **Phase 6（Memory）**：跨 workspace 隔离；含密钥内容写入被拒；来源/时间可追溯。
- **Phase 7（Multi-Agent）**：同 workspace 并发写互斥；角色链顺序执行；部署类请求一律转人工。

## 3. 安全回归套件（每阶段必跑）

1. `.env` 直读 / 索引吸收 / 搜索泄露 / 对话诱导 四路测试 → 全拒或 redact
2. 路径穿越：`../`、绝对路径、URL 编码、符号链接 → 全拒
3. denylist 全量逐条（含 `curl|sh`、`Invoke-Expression`、`node -e`、force push、reset --hard、clean）→ 403 + 审计
4. 权限矩阵：USER/VIP/ADMIN/ENTERPRISE/DEVELOPER/DEV_LEAD/SUPER_ADMIN × 7 类端点 → 与 Security Model §6 一致
5. runner 容器：`whoami`≠root、无 docker.sock、无生产卷、资源限额生效

## 4. 真实任务验收（Phase 8，对应总验收标准）

| 任务 | 通过标准 |
|---|---|
| 导入一个真实 ZRH 项目 | workspace 创建 + 索引完成 + 树可浏览 |
| 修复一个前端 Bug | plan→diff→apply→build 过→commit 正确 |
| 修复一个后端 Bug | 同上 + unit test 过 |
| 完成一个小型全栈需求 | 前端+API+DTO 链路改动，Integration test 过 |
| 创建测试 | 生成测试可运行且通过 |
| Build 通过 | test 栈 `npm run build` 前后端全过 |
| Git Commit 正确 | 仅含批准文件、staged diff 已展示、SHA 落库、无无关夹带 |
| 输出完整报告 | 含 plan/diff/test/review/commit 全链证据 |

## 5. 总验收标准映射（20 条）

| # | 标准 | 验证层 |
|---|---|---|
| 1–4 | 导入/索引/关系回答/影响分析 | 集成 + 真实任务 |
| 5–6 | 先 Plan 后 Diff / 多文件修改 | 集成 |
| 7–9 | TypeCheck/Build/Test、读错修复、≥3 轮闭环 | Phase 4 用例 |
| 10–11 | 精确 Commit / 无夹带 | Phase 3 用例 |
| 12–14 | 不读 .env / 不越界 / 危险命令 403 | 安全回归 |
| 15–17 | RBAC / 授权 / 审计 | 安全回归 |
| 18 | PC/Pad/Phone 可用 | Playwright 三断点 |
| 19 | 中/缅/英完整 | i18n 词条校验 + E2E 截图 |
| 20 | Production 影响 0 | 部署清单比对 + 生产巡检脚本 |

## 6. 测试数据与夹具

- 样本仓库：ZRH-AI 自身（bind workspace）+ 一个 git clone 样本。
- 漏洞样本集：`fixtures/vuln-samples/`（secret、SQLi、越权、路径穿越各 5 例，合成代码，不含真实密钥）。
- 所有测试仅在 test/UAT 栈执行；禁止以 production 数据做夹具。

## 7. 出口准则（进入 Phase 9 RC）

- §3 安全回归全过；§4 真实任务全过；§5 映射 20 条全过；已知缺陷清零或经赵总书面接受。
