# Canonical Skill Format v0.2

每个 skill 是一个 `.md` 文件，包含 YAML frontmatter（元数据）+ markdown body（指令体）。`skillctl sync` 把它渲染到目标平台。

## 字段全集

| 字段 | 必需 | 类型 | 说明 |
|---|---|---|---|
| `name` | ✅ | string | 唯一 ID，格式 `namespace:slug`，如 `experts:开发` |
| `type` | ✅ | enum | `expert` / `internal` / `tool` |
| `description` | ✅ | string ≤200 | 一句话描述（CC 注入到 system prompt） |
| `triggers` | ❌ | string\|array | 关键词（pipe 分隔字符串或数组）— hook 路由读 |
| `priority` | ❌ | enum | `high` / `medium` / `low`，默认 medium |
| `chain` | ❌ | array | 后继 expert 列表（仅 `type:expert` 有效） |
| `calls` | ❌ | array | 内部按需调用的 SlashCommand 列表 |
| `keywords` | ❌ | array | 检索关键词（V3 embedding 用） |
| `version` | ❌ | semver | 默认 `0.1.0` |
| `platforms` | ❌ | array | 目标平台，默认 `[claude-code]` |
| `maintainer` | ❌ | string | 维护者标识 |

## 类型语义

| type | 暴露给 agent？ | hook 强制路由？ | chain/calls 有效？ |
|---|---|---|---|
| **expert** | ✅（description 注入 system prompt） | ✅ | ✅ |
| **internal** | ❌（短 description） | ❌ | calls 有效 |
| **tool** | ❌ | ❌ | ❌ |

## 命名规则

- `<namespace>:<slug>`，namespace 全小写字母或下划线
- slug 允许中文、英文、数字、`-`、`_`
- expert 类一律 `experts:` 前缀
- 内部 skill 一律 `_internal:` 前缀（避免与原生 SlashCommand 冲突）
- 工具类一律 `_tools:` 前缀

## 完整样例

```markdown
---
name: experts:开发
type: expert
description: 编码实现专家 — 多 Agent 并行开发，Agentless 修 bug 三段式
triggers: 开发|实现|编码|修bug|报错|崩溃|重构|性能
priority: high
chain: [experts:审查, experts:交付, experts:复盘]
calls: [_internal:autoresearch]
keywords: [编码, 多Agent, 修bug]
version: 0.2.0
platforms: [claude-code]
maintainer: 加州
---

# 开发专家
... 主体指令 ...
```

## 校验

`skillctl lint` 校验：
1. 必填字段齐全
2. type / priority 在枚举范围
3. name 符合 `namespace:slug` 格式
4. chain / calls 引用的 skill 在仓库内真实存在
5. description 长度（>200 警告，sync 时截断）

## 渲染产物（claude-code target）

| 输入 | 输出 1（SlashCommand） | 输出 2（Skill） | 输出 3（router 配置） |
|---|---|---|---|
| `~/skills-repo/experts/开发.md` | `~/.claude/commands/experts/开发.md` | `~/.claude/skills/experts/开发/SKILL.md` | `~/.claude/hooks/expert-router/router.json` 累加一条 entry |

CC 同时识别 SlashCommand 与 Skill —— 用户 `/experts:开发` 显式触发 OR agent 看见 description 自主调用，**双保险提高调用率**。
