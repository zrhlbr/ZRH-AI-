# 《ZRH AI Enterprise V1.2 Stabilization Final Report》

**Program:** V1.2 Stabilization（稳定化计划）  
**Branch:** `test/v1.2`  
**Date:** 2026-08-02  
**Production baseline:** V1.1.0（运行中，未改动上线）  
**Test line:** V1.2（测试中）  

---

## 0. 执行原则确认

本阶段严格执行：

- 禁止新增大型功能  
- 禁止进入 Vision 2.0 / V1.3  
- 禁止 Image / Video / Voice / Music / Digital Human / Foundation / Training / Research / Developer Agent 新功能  
- 优先级：**稳定 > 质量 > 安全 > 性能 > 维护 > 功能**

Vision 2.0 白皮书仅文档存在，**等待赵总批准**，未进入开发。

---

## 1. 所有模块评分（100 分制）

| # | Module | Score | Trend vs audit |
|---|--------|------:|----------------|
| 1 | Chat | **78** | 62 → 78 |
| 2 | Knowledge | **62** | 48 → 62 |
| 3 | Enterprise RAG | **68** | 52 → 68 |
| 4 | Developer Agent | **75** | 58 → 75 |
| 5 | Business Isolation | **70** | 55 → 70 |
| 6 | Performance | **65** | 静态评估 |
| 7 | Security | **76** | 62 → 76 |
| 8 | UI / UX | **74** | 72 → 74 |
| 9 | Auth / User Center / Admin | **80** | P1 已交付，本阶段未扩功能 |
| — | **综合稳定性** | **72 / 100** | — |

分报告路径：

- `docs/ZRH-AI-Enterprise-V1.2-Chat-Stability-Report.md`
- `docs/ZRH-AI-Enterprise-V1.2-Knowledge-Stability-Report.md`
- `docs/ZRH-AI-Enterprise-V1.2-Enterprise-RAG-Report.md`
- `docs/ZRH-AI-Enterprise-V1.2-Developer-Agent-Stability-Report.md`
- `docs/ZRH-AI-Enterprise-V1.2-Business-Isolation-Report.md`
- `docs/ZRH-AI-Enterprise-V1.2-Performance-Report.md`
- `docs/ZRH-AI-Enterprise-V1.2-Security-Report.md`
- `docs/ZRH-AI-Enterprise-V1.2-UI-UX-Report.md`

---

## 2. 存在问题（当前仍存在 / 曾存在）

### 高优先级（已大部分关闭，见第 3 节）

- Ollama 模型名被 `parseModelRef` 误解析  
- Chat 切换会话时流式内容串线程  
- Regenerate 先删后生成导致失败丢回复  
- Developer 终端可 shell 链式绕过白名单前缀  
- MCP filesystem/git 可盲打 Runner workspace  
- Diff 可绕过 Plan 直接写入  
- Dev session 缺少用户归属校验  
- JWT production 可回退硬编码密钥  
- Knowledge department ACL 过宽 / `departmentId` 未加载  
- RAG `hitRate` 指标语义错误  

### 中优先级（仍开放）

- Knowledge：CJK/缅文召回弱；embed 串联缺口；blob 删除竞态  
- RAG：无查询缓存；lexical rerank；citation 与截断 context 不完全一致；`/rag/ask` 与 Chat `minScore` 不一致  
- Chat：缺少统一服务端流超时 / Token 截断策略  
- Performance：无正式压测基线数字  
- Security：生产 API 只读挂载 `docker.sock`  
- UI：Developer 少量英文硬编码、loading 不足  

---

## 3. 已修复问题（本稳定化程序）

| ID | Fix | Area |
|----|-----|------|
| F1 | `parseModelRef` 仅识别已知 provider，否则整串作 Ollama 模型名 | Chat / Gateway |
| F2 | 切换会话 / 新对话 abort 流；按 conversation 绑定忽略错线程 UI | Chat FE |
| F3 | Regenerate 成功持久化后再删旧 assistant；前端保留至 done | Chat |
| F4 | Knowledge ACL 加载 department/role，对齐 RAG 风格授权 | Knowledge |
| F5 | RAG `hitRate`→查询命中 0\|1；`minScore` 传入 retriever | RAG |
| F6 | Terminal/Runner 拒绝 shell 元字符；关闭 terminal dangerous 旁路 | Developer |
| F7 | Diff 强制 approved `planId` | Developer |
| F8 | Dev session ownership 校验 | Developer |
| F9 | MCP→Runner：workspace ACL + 强制 `DEV_RUNNER_*` | Security / Isolation |
| F10 | 敏感路径拒绝扩展（.env / credentials / keys / .ssh） | Security |
| F11 | Production 强制 `JWT_SECRET` | Security |

---

## 4. 未修复问题（明确不做大型重构）

1. 真实向量索引 / pgvector 生产级替换  
2. Cross-encoder rerank 与 RAG 结果缓存  
3. Knowledge 缅文/CJK 分词与准确率黄金集  
4. 去掉生产 API `docker.sock`（需架构决策）  
5. Chat 服务端统一 idle/hard timeout 与 Token 策略产品化  
6. Developer UI 完整三语与精致响应式  
7. 全量自动化回归套件（本阶段仅清单）  
8. Vision 2.0 / 多模态 / Foundation — **禁止**

---

## 5. 性能数据

本环境 **未完成** 正式压测采集。工程判断见 Performance Report。

**RC 前必须补齐的基线：**

| Metric | Target suggestion（待赵总确认） |
|--------|----------------------------------|
| Chat TTFT（热模型） | 记录 p50/p95 |
| Chat 完整回答 | 记录 p50/p95 |
| RAG prepare | rewrite/retrieve/rerank ms |
| Knowledge search | p95 @ 文档规模档 |
| 并发 SSE | 10/50 无串会话、无崩溃 |
| docker stats | api/web/db/redis/runner 稳态 |

当前综合性能分：**65**（缺实测，不给 Production 放行）。

---

## 6. 安全数据

| Control | Status |
|---------|--------|
| RBAC + permission codes | 生效 |
| JWT secret（production） | **强制**，无硬编码回退 |
| Knowledge ACL | 已收紧 |
| Developer terminal injection | 已缓解 |
| MCP workspace 越权 | 已缓解 |
| Plan-first write | 已强制 |
| Runner docker.sock（test） | **未挂载** |
| API docker.sock（prod compose） | **仍 ro 挂载** — residual |
| Audit logs（Dev/MCP） | 存在 |

安全综合分：**76**。高危提权路径已关；残余为运维/架构级。

---

## 7. 稳定性评分

| Dimension | Score |
|-----------|------:|
| 功能正确性（关键路径） | 78 |
| 错误恢复 | 70 |
| 安全隔离 | 76 |
| 性能就绪 | 65 |
| 可维护性 / 回归准备 | 68 |
| **综合稳定性** | **72 / 100** |

---

## 8. 上线建议

### 结论（对赵总）

| Decision | Recommendation |
|----------|----------------|
| **V1.2.0 Release Candidate** | **有条件建议**：仅在 `test/v1.2` + test compose（`-p zrh-ai-test`）完成下方回归清单后，可打 **`v1.2.0-rc.1`**（非生产 tag `v1.2.0`） |
| **Production Release** | **不建议立即上线**。综合稳定性 72，Knowledge/RAG/性能基线未达标签字 |
| Vision 2.0 / V1.3 | **继续冻结**，等待批准 |
| V1.1.0 Production | **保持运行**，禁止用本分支镜像覆盖 |

### Phase 9 — Regression checklist（RC 前必做）

- [ ] Chat：send / continue / regenerate / stop / 切换会话 / 模型 `qwen3:8b`  
- [ ] Knowledge：upload → chunk → embed → search → permission  
- [ ] Enterprise RAG：hit / miss / fallback / citation 展示  
- [ ] Agent / Workflow / MCP（含 filesystem/git 拒绝越权）  
- [ ] Business Hub / ZRHPay / Accounting / Router OS 冒烟（互不影响）  
- [ ] Developer：workspace / plan approve / diff / terminal 拒绝链式命令 / audit  
- [ ] Admin / Super Admin / User Center / Auth  
- [ ] 三语切换 + 手机宽度冒烟  
- [ ] JWT_SECRET / DEV_RUNNER_TOKEN 未使用默认弱值  
- [ ] 确认 **未** 部署到生产 project `zrh-ai`

### 结束条件（本阶段）

- 未新增大型功能 ✔️  
- 未进入 Vision 2.0 开发 ✔️  
- 未进入 V1.3 ✔️  
- **等待赵总批准** 后，再决定：  
  1. 是否启动 `V1.2.0-rc.1`  
  2. 是否批准 Production Release  

---

**Signed status:** Stabilization engineering complete for current pass — **Awaiting 赵总 approval**.
