# Production Admin Default Account Report

**文档名称：** 《Production Admin Default Account Report》  
**环境：** ZRH AI Production · https://ai.zrhtech.com  
**执行时间：** 2026-08-02  
**批准：** 赵总确认执行  

---

## 1. 修改结果

| 项 | 结果 |
|----|------|
| 目标账号 | `admin`（id=1 · **SUPER_ADMIN**） |
| 用户名 | 保持 `admin`（未改） |
| 密码 | 已更新为赵总指定临时密码：`admin` |
| 哈希算法 | bcryptjs · cost 10（与系统一致） |
| UPDATE 范围 | `WHERE username='admin' AND role=SUPER_ADMIN AND id=1` → **1 行** |
| 其它用户 | **未修改**（全库仍仅 1 个用户） |
| 数据库结构 | **未修改** |
| 业务代码 | **未修改** |
| 权限 / 角色 | **未修改**（仍为 SUPER_ADMIN · status=active） |

---

## 2. 登录验证

| 检查 | 结果 |
|------|------|
| `POST https://ai.zrhtech.com/api/v1/auth/login` · `account=admin` / `password=admin` | **成功**（`code=0` · 获得 accessToken） |
| 同凭据 `username=admin` 变体 | **成功** |
| `https://ai.zrhtech.com/admin` 页面 | SPA 可访问（认证由登录 API 验证通过） |

**结论：登录验证成功。**

---

## 3. Git SHA

| 项 | 值 |
|----|-----|
| 本次变更 | **仅数据库密码字段** · 无代码提交 |
| 当前分支 tip（参考） | `214a12a`（与本次密码操作无关） |

---

## 4. Docker 状态（验证时点）

| 容器 | 镜像 | 状态 |
|------|------|------|
| zrh-ai-web | zrh-ai-web:1.2.1 | Up · healthy |
| zrh-ai-api | zrh-ai-api:1.2.1 | Up · healthy |
| zrh-ai-dev-runner | zrh-ai-dev-runner:1.2.1 | Up · healthy |
| zrh-ai-postgres | postgres:16-alpine | Up · healthy |
| zrh-ai-redis | redis:7-alpine | Up · healthy |

---

## 5. 不影响其它用户

| 项 | 结果 |
|----|------|
| 被更新用户数 | **1**（仅 admin） |
| 全库用户数 | **1** |
| 其它账号 | **无** |

---

## 6. 赵总后续动作（必须）

1. 打开 https://ai.zrhtech.com/admin（或 /login）  
2. 使用：用户名 `admin` / 密码 `admin` 登录  
3. **立即进入个人中心，修改为高强度新密码**  
4. 勿将临时密码 `admin` 长期保留  

---

## 7. 最终核对

| 项 | 状态 |
|----|------|
| 修改成功 | **是** |
| 登录验证成功 | **是** |
| Git SHA（代码） | **无**（DB-only） |
| Docker 状态 | **全部 healthy** |
| 不影响其它用户 | **是** |

---

*End of Report — Production Admin Default Account*
