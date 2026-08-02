# 《回滚方案》ZRH AI Enterprise Mail Center V1.0

**状态：** ⏳ 等待赵总批准  
**关联：** Change Plan · Impact Analysis  

---

## 1. 代码回滚（test / 未来 UAT）

1. `git revert` 本功能相关 commit（或 `git reset --hard` 至功能前 tip，仅限未推送/赵总授权时）  
2. 重建 `zrh-ai-api` / `zrh-ai-web`（test 环境）  
3. 验证：注册发码恢复为变更前行为；Super Admin 无 Mail Center 菜单  

**回滚点记录：** 实施开始前记录 `git rev-parse HEAD` → 写入 Implementation Report。

---

## 2. 数据回滚

| 方案 | 动作 |
|------|------|
| 方案 A（仅 system_configs） | `DELETE FROM system_configs WHERE "group" IN ('smtp','mail') OR key LIKE 'mail.%';` |
| 方案 B（含新表） | 迁移 down / 删除 `mail_templates`、`mail_send_logs`；并清理上述 configs |
| 用户数据 | **无需回滚**（不改 users） |
| verification_codes | 历史验证码可保留；不影响回滚 |

---

## 3. Auth 行为回滚

回滚代码后：`sendCode` 恢复「写库 + 日志 / devCode」行为。  
若曾改为「未配置则报错」，回滚即恢复旧逻辑。

---

## 4. 密钥与密钥材料

- `MAIL_CONFIG_CRYPTO_KEY` 仅用于邮件配置字段；删除 configs 后密文失效即可  
- 不轮换其它业务密钥  

---

## 5. Production

本阶段 **不部署 Production**，故 **无生产回滚步骤**。  
若未来上线后再回滚：按当时发布报告执行（镜像 tag + 配置清理），另案批准。

---

## 6. 验证回滚成功

- [ ] `/superadmin/mail-center` 404 或不存在菜单  
- [ ] `sendCode` 行为符合回滚点预期  
- [ ] Chat / Knowledge / 登录注册主流程无回归  
- [ ] 无残留失败的强制 SMTP 依赖（除非仍保留配置）  

---

**批准后实施时，将在开干前冻结回滚 SHA。**
