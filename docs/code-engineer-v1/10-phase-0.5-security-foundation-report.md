# Phase 0.5 Security Foundation Report — ZRH AI Code Engineer

- 日期：2026-08-06
- 分支：`test/v1.2`（基线 `ca7424f`，Phase 0.5 结束于 `9d43d6a`，报告本身为第 4 个提交）
- 范围：仅 Developer 模块 / dev-runner / test 栈 / 文档与测试。Auth、Mail、Chat、Knowledge、RAG、Workflow、Agent、Business、Admin、SuperAdmin 业务页与 Production compose/DB/镜像/配置均未改动。
- 状态：**全部验证通过，等待赵总验收；未进入 Phase 1。**

---

## 1. 基线

- 起点 HEAD：`ca7424f feat(auth): remove display name and invite code fields from register page`
- 开始前工作区干净；全部改动均以精确白名单方式暂存提交（无 `git add -A/-.`、无 `reset --hard`、无 `clean`、无 force push）。
- 变更范围证据：`git diff --name-only ca7424f..HEAD` 仅包含 developer / dev-runner / docker-compose.test.yml / docs/code-engineer-v1 / backend/prisma（schema+seed+phase05 迁移）/ backend/scripts 测试脚本 / frontend developer 页与三语言词条。

## 2. 文件清单（Phase 0.5 改动）

| 类别 | 文件 |
|---|---|
| Runner 加固 | `dev-runner/Dockerfile`、`dev-runner/src/server.js`、`dev-runner/test/git-commit.test.js` |
| Test 栈 | `docker-compose.test.yml`（runner 资源限制 + API 卷只读） |
| Schema / 数据 | `backend/prisma/schema.prisma`、`backend/prisma/migrations/20260806090000_phase05_security_foundation/migration.sql`、`backend/prisma/seed.js` |
| 后端 Developer | `audit.service.ts`、`developer.controller.ts`、`diff.service.ts`、`git-write.service.ts`、`orchestrator.service.ts`、`runner-client.service.ts`、`skills.service.ts`、`terminal.service.ts` |
| 前端 | `frontend/src/api/developer.ts`、`frontend/src/pages/DeveloperPage.tsx`、`frontend/src/i18n/locales/{zh-CN,en-US,my-MM}.json`（每语言仅 +5 行 diff 词条） |
| 测试 / 基准 | `backend/scripts/phase05-integration-test.js`、`docs/code-engineer-v1/benchmark-phase05.js`、`docs/code-engineer-v1/benchmarks-phase05.json` |

## 3. Runner 非 root 证明

- `docker exec zrh-ai-test-dev-runner id` → `uid=10001(zrh-runner) gid=10001(zrh-runner)`
- `docker inspect`：`User=zrh-runner, ReadonlyRootfs=true, CapDrop=[ALL], SecurityOpt=[no-new-privileges:true], MemLimit=4GiB, NanoCPUs=2.0, PidsLimit=128`
- 镜像内无 sudo；向 `/etc` 写入被只读根文件系统拒绝（构建后实测）。
- Workspace Volume 属主已用一次性 alpine 容器 `chown -R 10001:10001` 修正（卷 `zrh-ai-test_zrh-ai-test-workspaces`），修正后 runner 落盘、diff apply、git commit 全部成功（见集成测试）。

## 4. 资源限制

docker-compose.test.yml 中 dev-runner：`cpus: 2.0`、`mem_limit: 4g`、`pids_limit: 128`、`security_opt: no-new-privileges:true`、`cap_drop: ALL`、`read_only: true` + tmpfs(`/tmp`, `/home/zrh-runner`)。运行时 inspect 值见第 3 节，全部生效。API 服务的 workspaces 卷挂载已改为 `:ro`（inspect 显示 `Mode: ro`）。

## 5. Git 精确暂存证明

- 机制：commit 白名单取自该 workspace 最新 applied diff 的文件列表；两段式 —— step1（未 confirmed）只 stage 白名单并返回 staged stat，step2（confirmed=true）复核 staged 集合与白名单完全一致后才提交，不符即 `git reset` 撤销并返回 409。
- e2e 证据（集成测试）：applied diff 含 `src/one.ts`、`src/two.ts`，另放无关 `stray.txt`；step1 staged = 恰好 2 文件，`stray.txt` 保持 `??` 未跟踪；step2 返回完整 40 位 SHA `bef0e47c8235e12d2b9d3e077dcc9bc7e6a83e72`，`git show --name-only HEAD` 恰好 2 文件。
- `git add -A` / `git add .` / `git commit -am` 在 runner 层一律 403（denylist 实测，见第 11 节）。

## 6. RBAC 矩阵（调整后 = 当前生效）

| 角色 | api:developer:read | chat | write | terminal | admin |
|---|---|---|---|---|---|
| SUPER_ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ |
| DEV_LEAD（新） | ✓ | ✓ | ✓ | ✓ | ✓ |
| DEVELOPER（新） | ✓ | ✓ | ✓ | ✓ | ✗ |
| ADMIN | ✗ | ✗ | ✗ | ✗ | ✗ |
| ENTERPRISE | ✗ | ✗ | ✗ | ✗ | ✗ |
| VIP / USER | ✗ | ✗ | ✗ | ✗ | ✗ |

调整前：ADMIN 经通配过滤器继承全部 developer 权限；ENTERPRISE 拥有 read/chat/write。seed 幂等重建角色权限后上述权限已实际撤销（集成测试 403 实测为证）。seed 日志确认 7 角色、4 模型。

## 7. ADMIN → 403

集成测试：`GET /api/v1/developer/workspaces`（ADMIN token）→ HTTP 403。**PASS**

## 8. USER → 403

集成测试：同上（USER token）→ HTTP 403；VIP / ENTERPRISE 同样 403；无 token → 401；DEVELOPER 调 admin 级 `POST /developer/workspaces` → 403。**全部 PASS**

## 9. SUPER_ADMIN 正常

- 登录成功（凭证取自容器自身 env，未打印）。
- `GET /developer/workspaces` → 200。
- 回归冒烟（全部只读）：`/health`（database/redis/ollama online）、`/auth/profile`、`/chat/list`、`/knowledge/folders`、`/superadmin/mail/status` → 全 200。注册/登录/Mail 无回归。

## 10. 默认 Code Model

- Ollama 本地模型：`qwen2.5-coder:7b`（4.7GB，pull 于本阶段）；`ollama ps` 实测 100% GPU 加载。
- 路由：`dev_provider_settings.local-coder`（enabled=true，`configJson.modelRef=ollama:qwen2.5-coder:7b`，seed 幂等 upsert）；回退链 `DEV_CODER_MODEL` env → `ollama:qwen2.5-coder:7b`。review/deploy_diag 技能仍走 `qwen3:8b`。`cursor-cloud` enabled=false。
- API 实测：新建 Developer session（未指定模型）→ `modelRef=ollama:qwen2.5-coder:7b`。**qwen2.5-coder 已是默认 Code Model。**

## 11. 模型基准（qwen2.5-coder:7b，本机 RTX 5060 Laptop）

原始输出与计时：`docs/code-engineer-v1/benchmarks-phase05.json`；脚本：`benchmark-phase05.js`。吞吐稳定在约 **70 tok/s**（69.7–70.6），单任务 wall time 2.8–8.1s。

| 任务 | 判定 | 说明 |
|---|---|---|
| TS 单文件修复 | PASS | off-by-one 修复正确，解释准确 |
| React 组件生成 | PASS | 防抖/清除按钮/aria 齐备；瑕疵：挂载时空串触发一次 onSearch |
| NestJS Controller/Service | PARTIAL | CRUD+ParseIntPipe 正确；import 路径与接口声明文件不一致 |
| Prisma schema 建议 | PARTIAL | 指出 3 个真实问题；改进模型漏 `@@index`，Item 缺反向关系字段（不可直接编译） |
| 单测生成 | PASS | 覆盖区间内/越界/异常分支 |
| 多文件影响分析 | PARTIAL | 给出逐文件改动与上线顺序，但误答成 sync→async 改造而非 `User→User\|null` 空值处理 |

结论（不夸大）：**3 PASS / 3 PARTIAL / 0 FAIL**。适合单文件修复、组件脚手架、单测生成；跨文件语义推理与多文件一致性偏弱，Phase 1 编排时需人工 review 门禁兜底。GPU 显存监控：`nvidia-smi` 在本机报 `Failed to initialize NVML: Unknown Error`（WSL/驱动问题），以 `ollama ps`（4.7GB、100% GPU）与实测吞吐佐证模型确在 GPU 上运行。

## 12. Diff SHA 校验证据

- 创建 diff 时捕获 `baseSha`（文件不存在则标记为新文件）；apply 前重新读文件比对 SHA，不一致 → HTTP 409 `SHA conflict — file changed since diff creation: fileA.txt`，文件保持未被触碰。
- 全量 content 强制：非 delete 变更缺 content → 400；patch 重放路径已在 runner `/fs/apply-patch` 移除。
- e2e：故意经 runner 带外篡改文件后 apply → 409，内容保持篡改态不变。**PASS**

## 13. 快照回滚测试

- apply 事务式：全校验 → 全快照（`dev_snapshots`）→ 全写 → 记录 `afterSha`；任一步失败整体回滚到快照。
- e2e：重建基线的 diff apply 成功（v3）→ rollback → 文件内容还原为快照态，diff 状态 `rolled-back`。**PASS**

## 14. 审计字段

`DevAuditLog` 新增 `userAgent`、`meta`(JSONB)，并在 `git.commit` / `diff.apply` / `diff.rollback` / terminal 等动作写入 ip / UA / 结构化 meta（文件清单、diffId、commitSha、确认态）。e2e 实测最新 `git.commit` 行 ua/meta 非空、`diff.apply` meta 非空。敏感形值入库前 redact。

## 15. TypeCheck

- 后端 `tsc -p tsconfig.json --noEmit` → 通过（2026-08-06 重跑取证）。
- 前端 `tsc -b --noEmit` → 通过（同日重跑取证）。

## 16. Build

- 后端/前端/runner 三个镜像（`zrh-ai-api:1.2.0-test`、`zrh-ai-web:1.2.0-test`、`zrh-ai-dev-runner:1.2.0-test`）重新构建成功（镜像构建内含后端 tsc 与前端 vite build，构建成功即编译通过）。
- 容器运行中且 healthy，API 实际 serving dist 产物。

## 17. Unit Test

- `dev-runner/test/git-commit.test.js`：宿主机 Windows 8 过 1 跳过（symlink 用例受 Windows 权限限制）；**Linux 容器内重跑 9/9 全部通过**（symlink 逃逸拒绝用例生效）。

## 18. Integration Test

`backend/scripts/phase05-integration-test.js`（API 容器内执行）：**56/56 PASS**。覆盖 RBAC 矩阵 9 项、workspace 创建权限 2 项、回归冒烟 5 项、模型路由 4 项、diff 生命周期 14 项、git 精确暂存 7 项、runner 安全 13 项、审计 2 项。临时测试用户用后删除。

## 19. Runner Security Test

实测全部拒绝/受控：`rm -rf /`、`git add -A`、`git add .`、`git commit -am`、`git reset --hard`、`git clean`、`curl … | sh`、`powershell`、`Invoke-Expression` → 403；路径穿越与 `.env` 读取 → 400；无 token → 401；死循环脚本 2s 超时 → status=timeout；并发上限 2 → 第 3 个请求 429。**13/13 PASS**

## 20. Git Workflow Test

见第 5 节：两段式确认、白名单精确暂存、无关文件不混入、完整 SHA 返回、commit 内容精确。**7/7 PASS**。另：危险 git（reset-hard/clean/push-force）runner 层默认拒绝。

## 21. RBAC Test

见第 6–9 节：**矩阵 7 角色 × 读写两级 + 未认证，共 10 项全部 PASS**；ADMIN 业务管理能力不受影响（seed 仅剥离 developer 权限，Admin/SuperAdmin 页面与接口零改动）。

## 22. Docker 状态 / Production Impact

- test 栈：`zrh-ai-test-web` Up、`zrh-ai-test-api` Up (healthy)、`zrh-ai-test-dev-runner` Up (healthy)、postgres/redis healthy。
- Production impact = **0**：未触碰任何 production/stage compose、镜像、数据库与配置；`zrh-ai-api`（生产）等 20+ 容器全程未重启、未变更（`docker ps` Up 44h 连续运行）。
- 迁移只在 test 库（`zrh_ai_test`）应用；seed 幂等，仅在 test 栈 entrypoint 自动执行。

## 23. Commit SHA 列表

| # | SHA | 说明 |
|---|---|---|
| 1 | `c2fe873` | docs(code-engineer): add phase 0 audit and architecture plans |
| 2 | `864b9d7` | fix(developer): harden runner git workflow and developer access |
| 3 | `9d43d6a` | feat(developer): add local qwen coder routing and benchmarks |
| 4 | 本报告所属提交（git log `ca7424f..HEAD` 第 4 条） | docs(code-engineer): add phase 0.5 security foundation report |

## 24. 遗留风险（如实声明）

1. **UAC 级 UAT 未做**：本阶段为 API/runner 层自动化验证，未进行人工 UI 验收（前端两步确认与回滚按钮已实现并通过 typecheck/build，未做浏览器端手测）。
2. **Workspace 创建仍需 `api:developer:admin`**：即仅 DEV_LEAD/SUPER_ADMIN 可建 workspace；DEVELOPER 只能在被授权的 workspace 内工作。如需放开需赵总决策。
3. **API 与 runner 共享卷已改只读**，但"任务结束自动撤销 workspace 访问"的回收机制留待 Phase 1。
4. **模型基准样本小**（6 任务 × 单次运行），PARTIAL 项表明跨文件语义能力有限，Phase 1 必须保留人工 review 门禁。
5. **`nvidia-smi` 不可用**（NVML 初始化失败），GPU 监控暂以 `ollama ps` + 吞吐实测佐证；建议后续修复驱动/WSL 配置。
6. **`git revert` 等写操作仍依赖 runner 白名单与审计，rebase/merge 类操作未开放**（符合冻结约束，Phase 1 再评估）。
7. test 库中保留了本阶段产生的测试 workspace/plan/diff 数据（workspace id≥2），未清理，供验收时复查。

## 25. 是否具备进入 Phase 1 的资格

- 安全基线四项硬指标（非 root runner、精确暂存、RBAC 收紧、SHA+快照）全部落地并有自动化证据。
- 默认编码模型已切换至本地 qwen2.5-coder:7b，云模型关闭。
- TypeCheck / Build / Unit(9/9) / Integration(56/56) / Security(13/13) / Git(7/7) / RBAC(10/10) 全绿。
- **结论：具备 Phase 1 准入条件。按指令已停止，等待赵总审批。**
