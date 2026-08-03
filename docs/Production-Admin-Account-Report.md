# Production Admin Account Report

**文档名称：** 《Production Admin Account Report》  
**环境：** ZRH AI Production（`192.168.10.74` · DB `zrh_ai`）  
**查询时间：** 2026-08-02  
**方式：** 只读查询 `users` / `roles` / `user_login_logs` / `user_sessions`  
**约束遵守：** 未猜密码 · 未输出密码哈希 · 未重置密码 · 未改业务代码 · 未改其它用户  

---

## 1. 表结构结论

| 项 | 结果 |
|----|------|
| `users` | **存在**（Prisma `User`） |
| `admins` 独立表 | **不存在**（`to_regclass('public.admins')` → 无） |
| 角色表 `roles` | SUPER_ADMIN / ADMIN / USER / VIP / ENTERPRISE |

---

## 2. 角色是否存在

| Role code | 角色名 | 用户数 |
|-----------|--------|--------|
| **SUPER_ADMIN** | 超级管理员 | **1** |
| **ADMIN** | 普通管理员 | **0** |
| USER | 普通用户 | 0 |
| VIP | VIP 用户 | 0 |
| ENTERPRISE | 企业用户 | 0 |

**结论：** 存在 **SUPER_ADMIN**；**ADMIN 角色定义存在，但无对应账号**。

---

## 3. 管理员账号清单（无密码哈希）

| ID | 用户名 | 显示名 | 邮箱 | 手机号 | Role | status |
|----|--------|--------|------|--------|------|--------|
| 1 | `admin` | ZRH Administrator | （空） | （空） | **SUPER_ADMIN** | **active** |

全库 `users` 计数：**1**（仅此账号）。

---

## 4. `admin` 可登录 / 锁定 / 禁用检查

| 检查项 | 结果 | 依据 |
|--------|------|------|
| 是否禁用 | **否** | `status = active`（非 `disabled`） |
| 是否锁定 | **否** | `users` 无 lock 字段；系统无独立锁定列 |
| 密码是否已设置 | **是** | `passwordHash` 存在且长度有效（仅布尔判定，未输出哈希） |
| 是否可登录（账号态） | **可以** | `active` + 有密码哈希；近 24h 登录日志 **成功 5 / 失败 1** |
| 近期失败原因 | 1 次 `bad password`（2026-08-02 06:45:53） | 随后有成功登录 |
| 活跃会话 | 存在未撤销 session（如 id=5，expires 2026-08-09） | `user_sessions.revokedAt` 为空 |

**说明：** 未尝试猜测或暴力测试密码；「可登录」指账号状态允许登录，且生产日志证明近期曾成功认证。

---

## 5. 密码重置

| 项 | 状态 |
|----|------|
| 是否已重置 | **否** |
| 原因 | 需 **赵总明确确认** 后才执行临时强密码重置 |
| 若确认后的执行原则 | 仅重置 `username=admin`（id=1）；临时随机强密码只写入本报告；要求首次登录立即修改；禁止改其它用户 |

**请赵总回复是否需要重置 `admin` 密码。**  
回复示例：`确认重置 Production admin 密码`

---

## 6. 风险与建议

1. 生产目前 **仅 1 个 SUPER_ADMIN**，无备用 ADMIN —— 建议赵总批准后增设受控管理员或保管恢复流程。  
2. `admin` 无邮箱/手机 —— 不利于自助找回；可后续在批准下补齐。  
3. 若需重置：使用一次性强密码 + 强制改密，并撤销全部旧 `user_sessions` / refresh tokens。

---

## 7. 最终结论

| 项 | 结论 |
|----|------|
| SUPER_ADMIN | **存在**（`admin`） |
| ADMIN 账号 | **不存在**（角色空） |
| 禁用 | **否** |
| 锁定 | **否** |
| 可登录（状态） | **是** |
| 密码重置 | **等待赵总确认** |

---

*End of Report — Production Admin Account*
