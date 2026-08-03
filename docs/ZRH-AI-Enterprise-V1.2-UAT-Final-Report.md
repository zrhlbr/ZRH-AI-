# 《ZRH AI Enterprise V1.2 UAT Final Report》

**Program:** User Acceptance Testing（用户验收）  
**Branch:** `test/v1.2`  
**Date:** 2026-08-02  
**Constraints:** 禁止 RC · 禁止 Production · 禁止新增大型功能 · 禁止 Merge main · 禁止 Vision 2.0 · V1.1 Production 保持不动  

---

## 0. 执行摘要

| Item | Result |
|------|--------|
| UAT 方法 | 代码路径全量验收 + i18n 键对账 + 关键缺陷热修 + 生产只读健康探活（**未**对生产做写操作） |
| V1.2 独立 test 栈 | **未部署**（主机无 `zrh-ai-test`；`.env.test` 不存在） |
| 主机 `zrh-ai-* :3010/4010` | 镜像 `zrh-ai-api:0.1.0` — **视为 V1.1 生产线，本轮未改动** |
| **是否建议进入 RC** | **否（Not Ready）** |
| **等待** | **赵总审批** |

### 综合评分：**79 / 100**

| Dimension | Score |
|-----------|------:|
| 功能评分 | **82** |
| 稳定性评分 | **76** |
| 性能评分 | **80** |
| 安全评分 | **83** |
| 用户体验评分 | **74** |
| **综合** | **79** |

---

## 1. UAT 测试结果（按范围）

图例：✅ PASS · ⚠️ PARTIAL · ❌ FAIL · ⬜ BLOCKED（缺独立 V1.2 运行时）

### 1.1 Chat — ⚠️ PARTIAL（82）

| Case | Result | Notes |
|------|--------|-------|
| 新建会话 | ✅ | store `newChat` + SSE 首条创建 |
| 长对话 / History | ✅ | `HISTORY_LIMIT=30` |
| Continue | ✅ | appendToMessageId |
| Regenerate | ✅ | 成功后再删旧消息 |
| Streaming / SSE | ✅ | meta/rag/delta/done/error |
| 多语言 | ⚠️ | UI i18n OK；prompt locale 未随 UI 传入 |
| 上下文连续性 | ✅ | 用户隔离 conversation |
| 异常恢复 | ⚠️ | 有 error banner；缺一键 Retry |
| 切换会话 / 新对话 | ✅* | UAT 热修：`streamEpoch` 防串流 |

\*热修后代码路径通过；需独立 test 栈手工冒烟确认。

### 1.2 Knowledge — ✅ PASS（86）

| Case | Result |
|------|--------|
| Upload → Chunk → Embedding | ✅（含 parse 串联 embed） |
| 检索 / CJK·缅文 | ✅（bigram + contains） |
| ACL | ✅（列表搜索不再绕过 ACL） |
| Reindex | ✅（状态 chunked + task） |
| 文档管理 / Blob 删除 | ✅（引用计数） |
| 运行时上传验收 | ⬜ BLOCKED（无 V1.2 test 栈） |

### 1.3 Enterprise RAG — ✅ PASS（87）

| Case | Result |
|------|--------|
| Rewrite / Retrieve / Rerank | ✅ |
| Citation ⊆ Context | ✅ |
| HitRate / MinScore | ✅（对齐 + 后置阈值） |
| Fallback | ✅（RAG 失败 → plain chat） |
| Cache | ✅（Redis prepare/ACL，fail-open） |
| 在线命中实测 | ⬜ BLOCKED |

### 1.4 Developer Agent — ⚠️ PARTIAL（78）

| Case | Result |
|------|--------|
| Workspace / ACL | ✅ |
| Plan / Diff | ✅*（UAT：plan↔workspace 绑定） |
| Terminal / 危险命令 | ✅（metachar 拒绝） |
| Git / Runner / Audit / Skills | ⚠️ | Runner 需强制 TOKEN；Skills 无细粒度 ACL |
| 运行时 Runner 联调 | ⬜ BLOCKED |

### 1.5 Workflow / Agent / MCP — ⚠️ PARTIAL（77）

| Case | Result |
|------|--------|
| MCP HTTP invoke + workspace ACL | ✅ |
| Workflow → MCP user 绑定 | ✅*（UAT P0 热修） |
| Workflow history 隔离 | ✅*（非 Admin 仅自己的 runs） |
| 全链路联调 | ⬜ BLOCKED |
| Agent 权限表面 | ✅（`api:agents:*`） |

### 1.6 Business — ✅ PASS（isolation 84）

| Module | Result |
|--------|--------|
| ZRHPay / Accounting / Router OS / Hub | ✅ 独立模块；无 Chat 写路径耦合 |
| 接口隔离 | ✅ |
| 业务端到端交易验收 | ⬜（多为 stub/reserved，符合现阶段） |

### 1.7 Auth — ⚠️ PARTIAL（80）

| Case | Result |
|------|--------|
| 注册 / 登录（account·email·phone 查找） | ✅ |
| Remember Me / JWT / RBAC | ✅ |
| 忘记密码 | ⚠️ | 非生产靠 `devToken`；无真实 SMTP |
| Phone 验证码 | ⚠️ | reserved |
| Session | ✅ | access + refresh |

### 1.8 Admin / Super Admin — ⚠️ PARTIAL（68）

| Case | Result |
|------|--------|
| 菜单 / 路由 / 核心权限门 | ✅ |
| 全部菜单可用 | ❌ | 大量 Placeholder（Knowledge/Models/…/Logs） |
| 操作日志 | ❌ | Admin logs UI 占位；Super logs reserved |
| 系统设置 | ⚠️ | 部分 reserved |

### 1.9 UI / UX — ⚠️ PARTIAL（74）

| Case | Result |
|------|--------|
| 中/英/缅 **键完整** | ✅ 445/445/445，缺失 0 |
| 缅文内容质量 | ⚠️ | **77** 键仍等于英文（nav/admin/developer 等） |
| PC / 响应式 sm·lg | ✅ | Tailwind 断点广泛使用 |
| Pad / 手机精致验收 | ⬜ | 缺实机；布局有断点但未设备签核 |
| Dark Mode | ✅ | 设计系统深色主题（现有 zrh-*） |
| Loading / 动画 | ⚠️ | Chat OK；Developer loading 弱 |

### 1.10 Stability / Performance 环境 — ⚠️ PARTIAL（76 / 80）

| Case | Result |
|------|--------|
| 生产栈只读探活 `GET /api/v1/health` | ✅ HTTP 200（**V1.1 线，非 V1.2**） |
| docker stats（生产容器快照） | ✅ api/web/postgres/redis 运行中 |
| V1.2 连续运行 / 长 SSE / 泄漏 | ⬜ BLOCKED |
| Redis / PG / Ollama / Docker（V1.2） | ⬜ BLOCKED |
| 工程性能（R2） | ✅ 向量限定扫描、缓存、池化、流超时 |

**生产 docker stats（只读快照，供对照，非 V1.2 UAT）：** 采集时 `zrh-ai-api/web/postgres/redis` 均 Up；详细百分比以当时 `docker stats --no-stream` 为准。

---

## 2. Bug 清单（按严重程度）

### P0（阻断级）

| ID | Status | Description |
|----|--------|-------------|
| UAT-P0-01 | **已修复** | Workflow MCP `payload.userId` 可伪造 → 强制绑定执行者 `userId` |

### P1（高）

| ID | Status | Description |
|----|--------|-------------|
| UAT-P1-01 | **已修复** | Chat「新对话」时流式可能回绑 activeId（`streamEpoch`） |
| UAT-P1-02 | **已修复** | Diff 可用他仓 approved plan（校验 `plan.workspaceId`） |
| UAT-P1-03 | **已修复** | Workflow history 跨用户可读（非 Admin 按 `userId` 过滤） |
| UAT-P1-04 | **已修复** | Dev Runner / API 默认弱 TOKEN（改为必须配置） |
| UAT-P1-05 | **未修复** | 真实邮件/SMS 未发送（验证码仅日志） |
| UAT-P1-06 | **未修复** | Admin / Super Admin 审计日志 UI 未实现 |
| UAT-P1-07 | **未修复** | 独立 V1.2 test 栈未部署 → 运行时 UAT 阻塞 |

### P2（中低）

| ID | Status | Description |
|----|--------|-------------|
| UAT-P2-01 | 未修复 | Continue 可能双气泡（旧消息 + streaming） |
| UAT-P2-02 | 未修复 | `/chat/:id` 深链未接线 |
| UAT-P2-03 | 未修复 | my-MM 77 键未本地化 |
| UAT-P2-04 | 未修复 | Admin 子菜单未按 permission 细分 |
| UAT-P2-05 | 未修复 | Token 存 localStorage（XSS 面） |
| UAT-P2-06 | 未修复 | RAG 缓存 TTL 内 ACL 可能短暂陈旧 |
| UAT-P2-07 | 未修复 | Folder 级 Knowledge ACL 偏简 |
| UAT-P2-08 | 未修复 | Skills 无细粒度权限 |

---

## 3. 已修复问题（本 UAT 轮）

1. Workflow MCP 强制 `userId`/`roleCode` 绑定执行者  
2. Chat `streamEpoch`：新对话/切换会话后旧流不可回绑 UI  
3. Diff `plan.workspaceId` 必须匹配  
4. Workflow history/get 用户隔离（Admin/Super 可看全部）  
5. `DEV_RUNNER_TOKEN` 强制（API client + runner 进程 + compose.test）  

**Backend `tsc --noEmit`：通过。**

---

## 4. 未修复问题（明确保留）

1. 邮件/SMS 真实投递  
2. Admin 占位菜单与审计日志产品化  
3. my-MM 内容翻译补全  
4. 原生 pgvector / cross-encoder  
5. V1.2 独立环境长稳压测与设备签核  
6. Vision 2.0 / 大型新功能 — **禁止**

---

## 5. 分项评分明细

| Module | Score | 说明 |
|--------|------:|------|
| Chat | 82 | 核心路径稳；缺运行时长测 |
| Knowledge | 86 | R2 + 代码 UAT PASS |
| Enterprise RAG | 87 | R2 + 代码 UAT PASS |
| Developer Agent | 78 | 权限面改善；缺 Runner 实机 |
| Workflow/MCP/Agent | 77 | P0 已关；缺联调 |
| Business | 84 | 隔离 OK；业务多为 stub |
| Auth | 80 | JWT/RBAC 强；出站验证弱 |
| Admin/Super | 68 | 门禁有、功能洞多 |
| UI/UX | 74 | 键齐；缅文/设备签核不足 |
| Stability | 76 | 无 V1.2 soak |
| Performance | 80 | 工程优化到位；缺 V1.2 数字 |
| Security | 83 | UAT P0/P1 安全项已关一批 |

---

## 6. 是否建议进入 RC

### **不建议进入 RC（No-Go）**

理由：

1. **无独立 V1.2 test 运行时**完成用户级冒烟（上传/SSE/Runner/三端设备）。  
2. Admin 审计与大量菜单仍为占位，企业验收缺口明显。  
3. 出站验证（邮件/SMS）未闭环。  
4. 综合 **79 < 85** 建议门槛；稳定性缺 soak 证据。  
5. 本轮约束也明确：**禁止进入 RC**。

### 进入 RC 前最低门槛（供赵总后续批准时参考）

- [ ] 部署 `zrh-ai-test`（3011/4011）并 migrate/seed  
- [ ] Chat/Knowledge/RAG/Auth 手工冒烟签字  
- [ ] Developer Runner 联调 + 危险命令否定用例  
- [ ] Workflow MCP 越权否定用例  
- [ ] 三语抽检（含原 77 缅文键）  
- [ ] 4h+ SSE/API soak + docker stats  

---

## 7. 环境与合规声明

| Item | Status |
|------|--------|
| V1.1 Production 未改配置/镜像/数据 | ✅ |
| 未 Merge `main` | ✅ |
| 未打 RC / Production tag | ✅ |
| 未进入 Vision 2.0 | ✅ |
| 未新增大型功能 | ✅（仅 UAT 缺陷热修） |

---

## 8. 审批

**Signed status:** V1.2 UAT engineering pass complete — **Awaiting 赵总审批。**

可选指令：

1. □ 认可本报告，继续 Round（部署 test 栈做运行时 UAT）  
2. □ 要求优先补 Admin 日志 / 邮件通道  
3. □ 其他：____________  

**禁止在未批准前：RC · Production · Merge main · Vision 2.0。**
