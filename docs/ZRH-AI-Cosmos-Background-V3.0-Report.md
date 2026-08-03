# 《ZRH AI Cosmos Background V3.0 Report》

**主题：** ZRH AI · AI Cosmos（人工智能宇宙）  
**统一视觉语言：** ZRH Technology Group · Blue White V2.0  
**日期：** 2026-08-03  
**状态：** 待赵总验收  
**业务逻辑：** **未修改**  
**Production Impact：** **0**（未部署、未改 API / DB / 权限）

---

## 1. 修改文件

| 路径 | 说明 |
|------|------|
| `frontend/src/components/background/TechBackground.tsx` | Cosmos / Shell 分流：仅 `landing`/`auth`/`home` 启用 Cosmos |
| `frontend/src/components/background/AiNebula.tsx` | Layer 2 AI Nebula（SVG + CSS，≈18%） |
| `frontend/src/components/background/NeuralNetwork.tsx` | Layer 3 神经网络节点连线 |
| `frontend/src/components/background/DataFlow.tsx` | Layer 4 少量缓慢数据流（手机关闭） |
| `frontend/src/components/background/AiCore.tsx` | Layer 5 AI Core 呼吸球（无旋转） |
| `frontend/src/components/background/performance.ts` | 色板 / DPR / 粒子 60% / reduced-motion |
| `frontend/src/components/background/ParticleField.tsx` | 恢复 Shell V2 粒子（Chat 等业务页） |
| `frontend/src/components/background/DigitalGlobe.tsx` | 恢复 Shell V2 球体（业务页） |
| `frontend/src/index.css` | Cosmos 渐变 / Glass blur 22px / Logo Glow / 表单可读性 |
| `frontend/src/pages/LandingPage.tsx` | Landing → Cosmos |
| `frontend/src/pages/LoginPage.tsx` | Login → Cosmos + AiCore |
| `frontend/src/pages/RegisterPage.tsx` | Register → Cosmos |
| `frontend/src/pages/ForgotPasswordPage.tsx` | Forgot Password → Cosmos |
| `frontend/src/pages/HomePage.tsx` | Welcome → Cosmos + AiCore |
| `frontend/scripts/cosmos-screenshots.mjs` | PC/Pad/Phone 截图与 FPS 采样脚本 |
| `docs/cosmos-v3-screenshots/*` | 验收截图与 metrics |
| `docs/ZRH-AI-Cosmos-Background-V3.0-Report.md` | 本报告 |

**未修改：** Chat / Knowledge / Developer / Workflow / Mail / Business 业务逻辑、API、数据库、权限。  
业务页仍走 `TechBackground variant="shell"`（默认），保持原浅色网格，**避免 Cosmos 串色**。

---

## 2. 技术实现

### 五层结构

| Layer | 内容 | 实现 |
|-------|------|------|
| 1 | 深蓝渐变宇宙 | CSS `.zrh-cosmos-gradient`：`#020617 → #0F172A → #1E3A8A → #2563EB` |
| 2 | AI Nebula | SVG 径向模糊 + CSS 呼吸；总透明度约 18% |
| 3 | Neural Network | Canvas 约 160 节点；近距连线；手机 `particleBudget × 0.6` |
| 4 | Data Flow | 3 条缓慢水平流；**手机关闭**；禁止炫酷流光 |
| 5 | AI Core | Canvas 点阵能量球；**~9s 呼吸**；**禁止旋转** |

### 交互与性能

- Logo：`.zrh-logo-glow` 柔和蓝白光晕  
- Card：`.zrh-glass-card` · `blur(22px)` · `border: rgba(255,255,255,.35)`  
- `document.visibilitychange` → 后台标签页暂停 rAF  
- `prefers-reduced-motion` → 停动画 / 静态 Core  
- 色板仅允许：`#020617 #0F172A #1E3A8A #2563EB #3B82F6 #60A5FA #DBEAFE #FFFFFF`  
- 禁止：紫 / 绿 / 金 / 红；禁止旋转银河 / 闪烁 / 照片壁纸  

### 覆盖页面

Landing · Login · Register · Forgot Password · Welcome（Home）

### PWA

安装后仍渲染同一套 Cosmos 层（CSS + Canvas），兼容 Android / iPhone / iPad 视口降级。

---

## 3. PC 截图

- Landing：`docs/cosmos-v3-screenshots/landing-pc.png`（1440×900）  
- Login：`docs/cosmos-v3-screenshots/login-pc.png`

---

## 4. Pad 截图

- Landing：`docs/cosmos-v3-screenshots/landing-pad.png`（820×1180）  
- Login：`docs/cosmos-v3-screenshots/login-pad.png`

---

## 5. Phone 截图

- Landing：`docs/cosmos-v3-screenshots/landing-phone.png`（390×844）  
- Login：`docs/cosmos-v3-screenshots/login-phone.png`  
- Phone：关闭 Data Flow；粒子约桌面 60%；保留 Logo / 星云 / 神经网络。

---

## 6. FPS

本地 Vite（`127.0.0.1:5173`）Playwright Chromium · `requestAnimationFrame` 1 秒采样：

| 设备 | 采样 FPS |
|------|----------|
| PC | **61** |
| Phone | **61** |

目标：Desktop 60FPS；Phone 自动降密度后保持流畅。

原始数据：`docs/cosmos-v3-screenshots/metrics.json`

---

## 7. 性能测试

| 项 | 结果 |
|----|------|
| Typecheck | `tsc --noEmit` 通过 |
| 后台暂停 | `visibilitychange` 取消 rAF |
| reduced-motion | Nebula 动画关闭；Core 静态一帧 |
| 手机降级 | 粒子 60%；Data Flow off；DPR ≤ 1.25 |
| GPU | 仅 2D Canvas + CSS；无 WebGL / 无照片纹理 |
| 业务串色隔离 | Chat 等默认 `shell`，不进 Cosmos |

---

## 8. Git Commit

见本次提交（whitelist：背景系统 + 上述页面 + 报告/截图）。  
**未 push / 未部署。**

---

## 9. Docker Health

本地观测（未因本任务重建镜像）：

| 容器 | 状态 |
|------|------|
| `zrh-ai-test-api` | Up · healthy |
| `zrh-ai-test-dev-runner` | Up · healthy |
| `zrh-ai-test-postgres` | Up · healthy |
| `zrh-ai-test-redis` | Up · healthy |
| `zrh-ai-api` / `zrh-ai-web` | Up · healthy |

本任务为前端视觉层，**未改 Docker / Compose / 生产镜像**。

---

## 10. Production Impact

**0**

- 未部署到 `ai.zrhtech.com`  
- 未改后端 / API / DB / 权限  
- 未经赵总批准，不继续修改其它模块  

---

**等待赵总验收。**
