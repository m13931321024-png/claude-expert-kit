---
name: _internal:smart-commit
type: internal
description: 智能提交 — 按模块分批中文 commit
keywords: [commit, 中文提交, 分批]
version: 0.2.0
platforms: [claude-code]
maintainer: 加州
---

# smart-commit

按模块分批 commit，commit message 中文规范（feat/fix/refactor/docs/chore）。

## 输入
- 待提交变更（git status）
- 仓库 commit 风格惯例（git log 最近 5-10 条对照）

## 步骤
1. git status / git diff 摸底
2. 按模块拆分：`git add <files>` 一批一批 stage
3. 每批 commit：`feat(模块): 简短描述（why 比 what 重要）`
4. 不要 `git add -A`（避免误带 secret / 副产物）

## 输出
commit 序列 + git log 摘要。
