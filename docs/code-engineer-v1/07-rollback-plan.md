# ZRH AI Code Engineer V1.0 — Rollback Plan（回滚方案）

- **阶段**: Phase 0 方案
- **总原则**: 每阶段可独立回滚；回滚目标始终是"回到上一稳定镜像 + 数据无损"；Production 全程不在变更路径上

---

## 1. 回滚资产

| 资产 | 内容 | 位置 |
|---|---|---|
| 稳定镜像基线 | `zrh-ai-api/web:1.2.2`（生产现状）、`1.2.0-test`（test 基线） | 本地镜像 + 重新 build 能力 |
| Git 基线 | `test/v1.2` @ `ca7424f`；每阶段打 `ce-v1-pN` 标签（test 线，非正式 tag） | 仓库 |
| DB 回滚 | 每个 migration 附 down；新表可整体 drop；seed 幂等可重放 | `backend/prisma/migrations` |
| 功能开关 | Test Loop / Review 闸门 / Memory 注入 / Multi-Agent 链均可独立关闭 | `dev_provider_settings` / 环境变量 |
| Diff 级回滚 | `dev_snapshots` 修改前快照，单 diff 一键恢复 | 应用内（Phase 3 起） |

## 2. 分阶段回滚

| 阶段 | 回滚方式 | 数据处置 |
|---|---|---|
| P0.5 安全前置 | 镜像回退 `1.2.0-test`；seed 重放恢复 ADMIN 继承 | 权限表为 upsert，重放即还原 |
| P1 Repository Brain | 关闭新索引 API；`code-index.service` 回退 git 版本；drop `dev_code_edges` | 旧三表（files/symbols/vectors）不受影响；扩列保留无害 |
| P2 Planner | 回退代码；扩列可空兼容无需 down | 无 |
| P3 Diff Engine | 功能开关回退"整文件 apply"旧路径；commit 白名单逻辑回退 | 快照表保留（只增） |
| P4 Test Loop | 关闭开关即回手动流程 | `dev_test_runs` 只读保留 |
| P5 Review | 闸门改"仅提示"或关闭 | `dev_reviews` 只读保留 |
| P6 Memory | 关闭注入 | 表保留可再启用 |
| P7 Multi-Agent | 关闭角色链 | 无 |
| P8 UAT | UAT 栈整体删除（`docker compose down -v`） | 独立卷随栈删除 |
| P9 RC | 不晋级即停留在 test/UAT | — |
| P10 Production | 默认方案=生产不启用 dev-runner，仅 API/Web 升级；回滚=镜像回退上一生产 tag + down migrations（若 P10 才执行结构迁移，须在发布单中列明） | 生产数据只增不改；回滚不删业务数据 |

## 3. 标准回滚操作（test/UAT 栈）

```bash
# 1) 应用级回滚（最常用）
docker compose -f docker-compose.test.yml down
ZRH_AI_IMAGE_TAG=1.2.0-test docker compose -f docker-compose.test.yml up -d

# 2) 代码级回滚
git checkout <上一阶段标签>     # 仅限 test 线；禁止 reset --hard / force push

# 3) DB 级回滚（仅在 test/UAT）
npx prisma migrate resolve --rolled-back <migration>  # 或执行该 migration 的 down SQL
```

生产回滚（仅 P10 后适用）：按发布单执行镜像回退 + 迁移 down + 验证清单；**禁止** `reset --hard`、`clean`、force push、删分支。

## 4. 回滚演练（Phase 9 强制）

1. test 栈升级到 RC → 执行一次完整回滚到 `1.2.0-test` → 验证：容器 healthy、历史 plan/diff/audit 数据可查、索引可用。
2. 快照回滚演练：apply 一个 diff → rollback → 文件字节级比对一致。
3. 权限回滚演练：seed 重放恢复 ADMIN 继承 → 矩阵复测。
4. 演练记录写入 UAT 报告，作为 P10 决策附件。

## 5. 不可回滚项声明

- 已落库的审计日志、test run、review 记录为**只增不删**（合规需要），回滚不清除，不构成风险。
- workspace 内用户代码改动以 git 历史 + 快照双重保障，无不可回滚路径。
