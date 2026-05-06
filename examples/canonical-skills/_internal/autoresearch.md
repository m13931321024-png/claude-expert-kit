---
name: _internal:autoresearch
type: internal
description: 自主实验循环 — 代码优化或知识研究的迭代器
keywords: [实验循环, 优化, 假设验证]
version: 0.2.0
platforms: [claude-code]
maintainer: 加州
---

# autoresearch

在已有 baseline + 评估命令的前提下做"假设→修改→评估→keep/discard"循环。

## 输入
- 优化目标：可量化指标
- 可改范围：哪些文件可以动
- 评估命令
- 循环上限（轮数）

## 输出
每轮：`[轮次] [keep/discard] 指标=值 | 假设简述`，最终给出最佳基线 + 改动 diff。
