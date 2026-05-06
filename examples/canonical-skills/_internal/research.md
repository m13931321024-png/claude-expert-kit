---
name: _internal:research
type: internal
description: 需求调研 — 问题清单→方案对比→结论
keywords: [需求调研, 方案对比, WebSearch]
version: 0.2.0
platforms: [claude-code]
maintainer: 加州
---

# research

把模糊需求拆成可对比的问题清单，调研对比后给结论。

## 步骤
1. 问题清单：把"我想要 X"拆成 3-5 个待验证子问题
2. 方案候选：每个子问题列 2-3 个候选方案
3. 对比矩阵：维度 × 方案打分（优势/劣势/复杂度）
4. 结论 + 推荐 + 理由

## 工具
- WebSearch / WebFetch — 社区最佳实践
- Agent(Explore) — 现状摸底
