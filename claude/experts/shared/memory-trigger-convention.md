---
name: Memory Trigger 约定
date: 2026-04-20
type: context
trigger: always
---

# Memory Trigger 约定（CC 按需加载记忆的语义）

CC 的 auto-memory 机制默认只把 `MEMORY.md` 索引注入系统 prompt，具体 `.md` 内容**需要模型主动 Read**。本约定定义"何时主动 Read 某条 memory"。

## trigger 字段语义

每个 memory `.md` 的 frontmatter 里 `trigger:` 字段支持以下格式，用 `|` 分隔多个条件（OR 关系）：

| 格式 | 含义 | 示例 |
|---|---|---|
| `always` | 每轮都按此记忆执行，不需要 Read（索引里 hook 即足够） | `trigger: always` |
| `keyword:X` | 用户消息含关键词 X（大小写不敏感、正则） | `trigger: keyword:对比\|vs\|方案` |
| `project:X` | 当前 cwd 路径含 X | `trigger: project:example-project` |
| `stage:X` | 当前 handoff.md 的 `current_stage` 等于 X | `trigger: stage:交付` |

## 模型的行为

读系统 prompt 看到 MEMORY.md 索引 → 按每行 trigger 决定：

1. `always` 的 → 不需要额外 Read，hook 一行足够（索引已给出核心）
2. `keyword:X` 的 → 判断当前用户消息是否含关键词，命中才 Read 完整内容
3. `project:X` 的 → 看 cwd 是否匹配，匹配才 Read
4. `stage:X` 的 → 看 handoff 当前 stage，匹配才 Read

## 为什么这么做

**Why**：CC 不限制每轮的 memory 总量，但每次 Read 都是显式工具调用，白读等于白烧 token。trigger 让模型"按需读"，而不是"每轮试读一遍看看"。

**对比 GA 的 L0-L4**：
- L0 元规则 = CLAUDE.md（全局约束）
- L1 索引 = MEMORY.md（每轮注入）
- L2 详细内容 = 各 `.md`（按 trigger Read）
- L3 SOP = `shared/sop_*.md`（按 keyword Read）
- L4 归档 = `~/.claude/projects/*/` transcripts（搜索时访问）

## 如何新增/修改 memory

1. 新增 memory `.md` 时，frontmatter 必须含 `trigger:` 字段
2. 选择 trigger 的判据：
   - **always**：影响身份认知、核心行为约束、每轮都要应用的偏好
   - **keyword**：特定话题才相关（比如"对比"、"commit"）
   - **project**：某个项目特有的约束
   - **stage**：某个专家阶段才相关（如 commit 偏好只在交付阶段需要）
3. 更新 `MEMORY.md` 索引时按 trigger 分组放
4. 若有多种触发条件，用 `|` 连接（OR）

## 反模式

- ❌ 把所有 memory 标 `always` — 又回到平铺，失去按需意义
- ❌ 在 `.md` 里写超过 30 行内容却标 `always` — 浪费每轮注入
- ❌ trigger 关键词过于宽泛（如 `keyword:the`）— 命中率 100% 等于 always

## 未来扩展

若 CC 原生支持 memory trigger（目前不支持），可写 hook `~/.claude/hooks/memory-filter/filter.sh` 在 UserPromptSubmit 时根据 trigger 输出 `[MEMORY-RELEVANT]` 提示。现阶段靠模型自觉读本约定执行。
