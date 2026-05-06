---
name: _internal:experience-review
type: internal
description: 任务复盘后的经验提炼 — 输出可执行 SOP，不是叙事
keywords: [复盘, 经验沉淀, SOP 蒸馏]
version: 0.2.0
platforms: [claude-code]
maintainer: 加州
---

# experience-review

任务结束后提炼可复用经验，沉淀到 learnings/ 或 shared/。

## 判据
一条经验如果不能被三个月后的新人照做，它就不是 SOP，只是故事。

## 输出格式（SOP 蒸馏）
```
inputs:    本任务的输入信号
steps:     N 步可执行流程
acceptance: 验收标准
scripts:   可复制的命令片段
```

## 何时不做
- 一次性的细节（"这次正好踩到 X"）
- 已经在 CLAUDE.md / shared/ 里覆盖的
