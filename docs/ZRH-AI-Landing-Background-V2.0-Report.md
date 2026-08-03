# 《Landing Background V2.0 Report》

**主题：** ZRH AI Blue White V2.0  
**范围：** 登录页 / 注册页 / 忘记密码 / 落地欢迎页 / 首页欢迎区 / 背景系统  
**日期：** 2026-08-03  
**状态：** ✅ 赵总审批通过（2026-08-03）· Design Polish Round 3 后锁定为 **Official Landing Background V2.0**  
**业务逻辑：** **未修改**  
**Production 影响：** **0**（未部署）

---

## 1. 目标

将落地与认证相关页面背景升级为三层科技背景，保持克制、低 GPU、可兼容 PC / Pad / Phone / PWA。

---

## 2. 三层结构

| Layer | 内容 | 实现 |
|-------|------|------|
| Layer1 | 浅灰网格 | CSS `.zrh-landing-grid` + 缓慢呼吸 |
| Layer2 | 超大 AI 科技球 | `DigitalGlobe` Canvas 点阵；**无旋转**；半径/光晕缓慢呼吸 |
| Layer3 | 蓝色神经网络粒子 | `ParticleField` 近距连线；已移除流光带 |

附加：环境径向光 `.zrh-bg-breathe`（非旋转）。

---

## 3. 视觉规则落实

| 要求 | 结果 |
|------|------|
| Blue White V2.0 | 使用 `--zrh-accent` / 浅灰网格 |
| Logo 柔和 Glow | `.zrh-logo-glow` |
| Card 玻璃拟态 | `.zrh-glass-card` |
| 动态 + 缓慢呼吸 | 网格 / 环境光 / 球体 ~8–10s |
| 禁止明显旋转 | 球体固定视角角，仅呼吸 |
| 禁止炫酷特效 | 已去掉粒子流光带 |
| 移动端降级 | 粒子 18（桌面 36）；球体点 280（桌面 520）；DPR≤1.5 |
| `prefers-reduced-motion` | CSS 动画关闭；球体单帧；粒子不启动 |
| 标签页隐藏 | `requestAnimationFrame` 暂停 |

---

## 4. 修改文件

| 文件 | 变更 |
|------|------|
| `frontend/src/components/background/TechBackground.tsx` | 三层合成 + variant |
| `frontend/src/components/background/DigitalGlobe.tsx` | 禁旋转 / 呼吸 / 移动降级 |
| `frontend/src/components/background/ParticleField.tsx` | 神经连线 / 去流光 / 降级 |
| `frontend/src/components/background/performance.ts` | **新增** 性能辅助 |
| `frontend/src/index.css` | grid / breathe / logo-glow / glass-card |
| `frontend/src/pages/LoginPage.tsx` | 视觉：球体 / logo glow / glass card |
| `frontend/src/pages/RegisterPage.tsx` | 同上 |
| `frontend/src/pages/ForgotPasswordPage.tsx` | 同上 |
| `frontend/src/pages/LandingPage.tsx` | 落地欢迎页三层背景 |
| `frontend/src/pages/HomePage.tsx` | 欢迎区 logo glow + glass 输入框（无业务改动） |

**未改：** Chat / Knowledge / RAG / Workflow / Agent / MCP / Business / Mail / API / DB / 权限。

---

## 5. 影响页面

- `/` Landing  
- `/login`  
- `/register`  
- `/forgot-password`  
- `/home`（欢迎视觉区背景）

---

## 6. 兼容性

| 端 | 策略 |
|----|------|
| PC | 全三层，粒子 36，球 520 点 |
| Pad | 同桌面密度（≥768） |
| Phone | 粒子 18，球 280，DPR 封顶 1.5，呼吸更慢 |
| PWA | `viewport-fit=cover` 兼容；背景 `overflow-hidden` |
| 减弱动画 | 静态网格 + 静态球 / 无粒子 |

---

## 7. 性能说明

- Canvas 2D only（无 WebGL）  
- 目标帧循环：`requestAnimationFrame`（约 60Hz）；隐藏页暂停  
- 球体不做连续旋转矩阵更新（固定视角）  
- 粒子 O(n²) 连线，n≤36  
- GPU：模糊仅用于玻璃卡片（静态 UI），背景动画以 Canvas/CSS opacity 为主  

本地：`npx tsc --noEmit`（frontend）**通过**。

---

## 8. 验收清单（赵总）

- [ ] 登录页：三层背景 + Logo Glow + 玻璃卡片  
- [ ] 注册页：同上  
- [ ] 忘记密码：同上  
- [ ] 落地欢迎页：超大科技球居中呼吸、无旋转  
- [ ] 首页欢迎区：Logo Glow / 球体呼吸  
- [ ] Phone：背景降级仍流畅  
- [ ] 关闭动画开关 / 系统减弱动画：无卡顿、无炫酷残留  
- [ ] 业务功能无回归（登录/注册/找回流程不变）

---

## 9. 停止声明

本报告完成后**停止**继续开发其它功能。  
**等待赵总最终验收。**
