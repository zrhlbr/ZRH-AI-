# ZRH AI Code Engineer V1.0 — Team Responsibilities（团队分工方案）

- **阶段**: Phase 0 方案
- **范围**: 人类团队分工 + AI 多角色分工（Phase 7 落地，V1.0 为顺序协作）

---

## 1. 人类团队

| 角色 | 职责 | 关键交付 |
|---|---|---|
| 赵总（最终决策人） | 阶段闸门审批；RBAC 变更批准；UAT 签收；Production 决策 | 各阶段签字/批示 |
| 技术负责人（Architect） | 架构守护；Review 各阶段设计与高危 diff；Policy Engine 规则维护 | 架构评审记录 |
| 全栈工程师 A（后端主） | Repository Brain / Planner / Diff Engine / Test Loop / Memory 后端 | 代码 + 单测 |
| 全栈工程师 B（前端主） | /developer 页面演进、Diff 视图、Test Loop/Review/Memory 面板、三语言、响应式 | 代码 + Playwright |
| DevOps（可兼任） | dev-runner 镜像、compose、资源限额、UAT 栈、回滚演练 | 运维手册 + 演练记录 |
| QA/安全评审（可兼任） | 安全回归套件、渗透用例、真实任务验收执行 | UAT 报告 |

> 团队规模可按 2–4 人弹性兼任；审批链不可兼任（技术负责人不能自审自批高危项）。

## 2. 审批矩阵

| 事项 | 提出 | 审核 | 批准 |
|---|---|---|---|
| Phase 启动 | 技术负责人 | — | 赵总 |
| RBAC / 权限模型变更 | 技术负责人 | QA/安全 | **赵总（强制）** |
| DB migration（test） | 工程师 | 技术负责人 | 技术负责人 |
| 危险 Git 操作（reset/clean/force push） | 工程师 | — | workspace owner + 系统二次确认 |
| UAT 验收 | QA | 技术负责人 | **赵总** |
| RC / Production | 技术负责人 | QA/安全 | **赵总（最终）** |

## 3. AI 多角色分工（Phase 7）

| Agent | 提出计划 | 写代码 | 测试 | 审核 | 批准部署 |
|---|---|---|---|---|---|
| Architect Agent | ✅ | — | — | — | — |
| Developer Agent | — | ✅ | — | — | — |
| Test Agent | （修复建议） | — | ✅ | — | — |
| Security Reviewer | — | — | — | ✅ | — |
| DevOps Agent | — | — | （诊断只读） | — | — |
| Documentation Agent | — | — | — | — | — |
| **人（赵总/授权人）** | — | — | — | — | ✅ **永远保留** |

## 4. 并发写冲突防控

- **单写者锁**：同一 workspace 同一时刻仅一个执行中的 diff（DB 状态机强制：存在 `applied` 之前状态的 diff 时，新 apply 排队或拒绝）。
- 多 Agent 在同一任务内**顺序**协作（Architect→Developer→Test→Security Reviewer），不并行写文件。
- 锁超时自动释放并记审计；会话归属校验（现状已有）防止越权接管。

## 5. 沟通与节拍

- 每阶段：启动会（审批）→ 中期自查 → 验收会（演示 + 报告入 `docs/`）。
- 所有阶段报告沿用现有 `docs/ZRH-AI-*-Report.md` 命名传统；Code Engineer 文档统一在 `docs/code-engineer-v1/`。
