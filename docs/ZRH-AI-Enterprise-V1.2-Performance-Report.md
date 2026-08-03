# ZRH AI Enterprise V1.2 — Performance Report

**Phase:** 6 / Stabilization  
**Branch:** `test/v1.2`  
**Date:** 2026-08-02  
**Scope:** API · Redis · PostgreSQL · Docker · CPU · Memory · GPU · Ollama · Cache · DB queries · Latency  

**Score: 65 / 100**（静态审计为主；本环境未跑完整压测）

---

## Verdict

架构具备缓存与流式能力，但 **缺少本阶段可引用的压测数字**。RAG 无结果缓存；Knowledge 检索在弱索引路径下可能偏慢。稳定性修复未引入明显热路径放大，亦未做性能优化型大改（符合「禁止大型功能」原则）。

---

## Observed / Expected（工程判断）

| Area | Assessment |
|------|------------|
| API (Nest) | 模块化；SSE 长连接需注意并发与 `active` Map |
| Redis | 若配置用于会话/缓存则有益；RAG 查询缓存仍缺 |
| PostgreSQL | Knowledge/RAG 查询复杂度是主风险；需 EXPLAIN 抽样 |
| Docker | test 与 prod 分离；多容器时 Ollama 外置 |
| CPU / Memory | 本地未采集；建议 test 栈 `docker stats` 基线 |
| GPU / Ollama | 依赖宿主机；模型加载是首包延迟主因 |
| Cache | RAG hit 无 cache → 重复查询成本高 |
| DB queries | ACL join 已加强，需防 N+1（list 文档路径） |

---

## Recommended baselines（RC 前必采）

1. Chat send TTFT / 完整响应 p50/p95（冷/热模型）。  
2. RAG prepare 分段：rewriteMs / retrieveMs / rerankMs。  
3. Knowledge search p95（10 / 100 / 1k docs）。  
4. `docker stats`：api / web / db / redis / runner。  
5. 并发 10/50 SSE 无崩溃、无串会话。

---

## Open

- 无正式压测报告数字可写入本文件（环境限制）。  
- JSONB / 全扫描路径未优化（刻意不做大型重构）。

---

## Go / No-Go

**Hold for Production** until 上述基线采集并达标（建议 Chat TTFT 与 RAG prepare 有明确 SLO 签字）。
