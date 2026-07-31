# Stage 3.5 数据库检查与优化建议

**检查时间：** 2026-07-31  
**数据库：** PostgreSQL 16（Docker `zrh-ai-postgres`）  
**当前数据规模：**

| 表 | 行数 | 大小 |
|---|---|---|
| messages | ~545 | 280 kB |
| conversations | ~68 | 160 kB |
| refresh_tokens | ~54 | 96 kB |
| 其他配置/权限表 | <100 | <80 kB |

---

## 1. 索引检查

已存在索引：

- `conversations`：`[userId, lastMessageAt DESC]`、`[userId, pinned]`、`[userId, favorite]`
- `messages`：`[conversationId, id]`
- `refresh_tokens`：`[userId]`、`tokenHash`（唯一）
- `conversation_folders`：`[userId]`
- 各主键、唯一约束（username、code、name 等）

**结论：** 当前索引覆盖核心查询路径（按用户列对话、按对话列消息、按 tokenHash 查刷新令牌）。

### EXPLAIN ANALYZE 实测

```text
-- 对话列表（按 lastMessageAt 倒序）
Execution Time: 0.158 ms
-- 单对话消息列表
Execution Time: 0.189 ms
-- 标题搜索
Execution Time: 0.124 ms
```

当前数据量极小，执行计划均为 Seq Scan；随着数据增长，上述复合索引会被启用。

---

## 2. 唯一约束与外键

- 所有外键均显式声明 `ON DELETE`：
  - 用户删除 → 级联删除 refresh_tokens、conversations、folders、chat_params
  - 对话删除 → 级联删除 messages
  - 角色删除 → 若仍有用户引用则 RESTRICT（安全）
  - 文件夹删除 → conversation.folderId 置 NULL
- 唯一约束：`users.username`、`roles.code`、`permissions.code`、`model_configs.name`、`prompt_templates.code`、`refresh_tokens.tokenHash`

**结论：** 删除策略合理，未出现悬置数据风险。

---

## 3. 慢查询与分页

- 当前未观察到慢查询（所有核心查询 < 1 ms）。
- `listConversations` 使用 `LIMIT`/`offset` 分页，适合当前规模。
- 当 conversations 达到 10 万+ 时，建议将 `offset` 改为基于游标（`lastMessageAt` / `id`）的分页。

---

## 4. 优化建议

| 优先级 | 建议 | 原因 |
|---|---|---|
| P1 | 为 `messages` 增加 `[conversationId, createdAt]` 或 `[conversationId, id DESC]` 索引 | 当前 `[conversationId, id]` 已覆盖升序；若未来需要倒序加载，可补充倒序索引 |
| P2 | 为 `refresh_tokens` 增加 `(expiresAt, revokedAt)` 复合索引 | 便于定时清理过期/撤销令牌 |
| P2 | 为 `conversations` 增加 `[folderId]` 索引 | 阶段 4 若开放文件夹管理，按文件夹查询需要独立索引 |
| P2 | 为 `messages.content` 增加 GIN / tsvector 全文索引（可选） | 当前标题搜索使用 `ILIKE`，未来若支持消息内容搜索，需要全文索引 |
| P3 | 监控 `pg_stat_statements` | 生产环境启用，用于捕获真实慢查询 |
| P3 | 定期 VACUUM ANALYZE | 大量消息删除后回收空间并更新统计信息 |

---

## 5. 风险项

- `messages.content` 为 `TEXT`，无长度限制；大数据测试显示 32 KB 以上输入会触发 DTO `@MaxLength(32000)` 限制，500 KB 会触发 body parser 限制。这是应用层限制，非数据库问题。
- 当前 `n_dead_tup` 不为零（conversations 30、refresh_tokens 36），说明有更新/删除操作；数据量小无需立即 VACUUM，但需纳入运维监控。

---

## 6. 总体评价

数据库设计符合 Stage 3 需求，索引、外键、删除策略均合理。当前数据量小，性能良好；随着用户量和消息量增长，按上述 P2/P3 建议逐步优化即可。
