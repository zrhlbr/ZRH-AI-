# ZRH AI Code Engineer V1.0 — Approval Checklist（审批清单）

- **阶段**: Phase 0
- **用途**: 赵总逐项核对后批准进入 Phase 1；同时作为后续各阶段闸门模板

---

## A. Phase 0 → Phase 1 进入审批（本次）

| # | 核对项 | 结果 | 签字 |
|---|---|---|---|
| 1 | 9 份 Phase 0 文档齐备并已读（Audit / Architecture / Development Plan / Impact Analysis / Security Model / Test Plan / Rollback Plan / Team / 本清单） | ☐ | |
| 2 | 现状审计结论认可：骨架正确，差距在 Repository Brain / Diff Engine / Auto Test Loop / 编码模型四点 | ☐ | |
| 3 | 同意插入 **Phase 0.5 安全前置修复**（runner 非 root、资源限额、移除 allowlist 死条目） | ☐ | |
| 4 | **批准 RBAC 变更**：developer 权限从 ADMIN 继承剔除，新增 DEVELOPER / DEV_LEAD 授权角色；ENTERPRISE 的 developer 权限收回统一授权 | ☐ | |
| 5 | **批准模型前置动作**：`ollama pull qwen2.5-coder:7b` 与 `bge-m3`（本机/服务器），并将 Orchestrator 默认编码引擎从 deepseek-coder 1B 切换 | ☐ | |
| 6 | 确认红线：本阶段及后续均不改 Auth/注册/登录/邮箱验证码/Mail Center/Chat/Knowledge/Enterprise RAG/Workflow/Agent/Business Hub/Admin/Super Admin/Production 数据 | ☐ | |
| 7 | 确认全程仅 test 栈（P8 起加独立 UAT 栈），Production 在 Phase 10 前零变更 | ☐ | |
| 8 | 确认文档从工作区迁入仓库 `docs/code-engineer-v1/`（迁入动作本身为文档新增，不改源码） | ☐ | |
| 9 | 确认总工作量预估 32–47 人日与阶段划分 | ☐ | |
| 10 | 批准进入 **Phase 1（Repository Brain）** | ☐ | |

**赵总批示**：____________________  **日期**：__________

## B. 各阶段通用闸门模板

| # | 核对项 |
|---|---|
| 1 | 本阶段验收标准全部达成并有证据（测试报告/截图/日志） |
| 2 | 安全回归套件（Test Plan §3）全过 |
| 3 | 新增 migration 已在 test 栈验证且 down 可用 |
| 4 | 审计日志抽查完整 |
| 5 | 三语言与移动响应式检查过 |
| 6 | 回滚方式已演练或书面确认可行 |
| 7 | 对现有业务模块影响复核 = 零 |
| 8 | 阶段报告已入 `docs/` |

## C. 需要赵总显式批准的高危事项（任何阶段出现即触发）

1. 任何 RBAC / 角色权限变更
2. 任何 Production 相关动作（P10 前原则上不出现）
3. 启用任何云端 AI provider（OpenAI/Anthropic/Gemini/Kimi/Cursor Cloud）
4. force push / reset --hard / clean / 删分支（除工作区内双闸门演示用例外，默认不批）
5. 引入新的第三方依赖（npm 包）超出已审清单（ts-morph、jsdiff 为 Phase 1/3 拟定，需确认）
6. 服务器采购 / GPU 扩容决策（未来增强版 32B–70B 方案）

## D. 放行记录

| 阶段 | 批准人 | 日期 | 备注 |
|---|---|---|---|
| P0 → P1 | | | |
| P0.5 | | | |
| P1 | | | |
| P2 | | | |
| P3 | | | |
| P4 | | | |
| P5 | | | |
| P6 | | | |
| P7 | | | |
| P8 (UAT 签收) | | | |
| P9 (RC) | | | |
| P10 (Production 决策) | | | |
