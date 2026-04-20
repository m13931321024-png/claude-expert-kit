# Claude Code 专家体系 — 从零搭建到日常使用

> 一份让任何 CC 用户能在 1 小时内把默认 CC 改造成"6 专家闭环 + 分层记忆 + 自动沉淀 SOP"的工程化 AI 工作流的完整指南。

---

## 目录

- [一、为什么要造这套](#一为什么要造这套)
- [二、一图看懂](#二一图看懂)
- [三、五大系统详解](#三五大系统详解)
- [四、一次对话发生了什么](#四一次对话发生了什么时序视图)
- [五、参考](#五参考)

---

## 一、为什么要造这套

默认的 Claude Code（CC）是"给你一个超强 Agent"，但**有七个痛点**在规模化使用后浮现：

| # | 痛点 | 表现 |
|---|---|---|
| 1 | 决策随机 | 同样一句"加个功能"，这次直接写代码，下次先问 5 个问题 |
| 2 | 权限打扰 | 改 10 个文件弹 10 次权限确认 |
| 3 | 上下文溢出无预警 | 一大段对话后突然 /compact 或模型开始忘记早期内容 |
| 4 | 经验散落 | 做完任务 → 经验在 commit message 或用户脑子里，下次同类任务从零开始 |
| 5 | 复用难 | 每次要重复解释"我是前端"、"我偏好 X"、"别做 Y" |
| 6 | 验证靠手 | Agent 改完 UI，还是要用户打开浏览器点点看 |
| 7 | 升级易失配 | CC 自动更新后自定义 wrapper 被覆盖、配置被重置 |

本体系对应每个痛点都有**系统级**的答案，不靠"让你每次多说一句"。

---

## 二、一图看懂

```
┌─────────────────────────────────────────────────────────┐
│                    用户输入任何消息                      │
└────────────────────────┬────────────────────────────────┘
                         ↓
     ┌───────────────────────────────────┐
     │  ① Hook 层（UserPromptSubmit 触发）│
     │  • router.sh → 注入路由规则 + handoff 摘要  │
     │  • context-monitor.sh → 40% 硬阻塞 + 暂存重放 │
     └───────────────┬───────────────────┘
                     ↓
     ┌───────────────────────────────────┐
     │  ② 模型判断（基于注入的路由表）    │
     │  闲聊/配置 → 直接回答              │
     │  做事 → 启动对应专家链             │
     └───────────────┬───────────────────┘
                     ↓
     ┌───────────────────────────────────┐
     │  ③ 专家链（6 个专家闭环）          │
     │  调研 → 设计 → 开发 → 审查 → 交付  │
     │                            → 复盘  │
     │  通过 handoff.md 接力              │
     └───────────────┬───────────────────┘
                     ↓
     ┌───────────────────────────────────┐
     │  ④ 记忆 + 经验层                   │
     │  L1 MEMORY.md 索引（每轮注入）     │
     │  L2 各 memory.md（按 trigger Read）│
     │  L3 shared/sop_*.md（可执行 SOP）  │
     │  L4 learnings/ + shared/（经验沉淀）│
     └───────────────────────────────────┘
                     ↓
     ┌───────────────────────────────────┐
     │  ⑤ 工具 MCP                       │
     │  • Playwright — UI 自动验证        │
     │  • Pencil / Figma — 设计稿         │
     │  • 其他按需                        │
     └───────────────────────────────────┘

辅助系统：
  • ~/.local/bin/claude（wrapper）→ 免权限弹窗
  • LaunchAgent claude-wrapper-self-heal → CC 升级后自动恢复 wrapper
  • ~/.claude-backups/ → 一键备份
```

---

## 三、五大系统详解

### 1. Hook 层（每次消息前运行）

**作用**：在模型看到用户消息前，给消息注入上下文（路由规则、当前流程状态、上下文用量警告）。

| Hook | 脚本 | 干什么 |
|---|---|---|
| Router | `~/.claude/hooks/expert-router/router.sh` | 每轮输出一份路由表 + 当前 handoff 摘要 + shared/learnings 文件名列表给模型参考 |
| Context Monitor | `~/.claude/hooks/context-monitor/context-monitor.sh` | 读 transcript 计算 token 用量；超 40% 则 block 消息、保存原文、要求 /compact |

两个 hook 通过 `~/.claude/settings.json` 挂载到 `UserPromptSubmit` 事件。

### 2. 专家链（6 个 skill 闭环）

每个专家是一个 `~/.claude/commands/experts/{name}.md` 文件，带 frontmatter 声明为 skill。模型通过 `Skill(experts:{name})` 加载执行。

| 专家 | 职责 | 关键技法 |
|---|---|---|
| **调研** | 把模糊需求变成清晰方案 | Agent(Explore) 理解现状 / WebFetch 调研方案 / 方案 A/B/C 对比表 |
| **设计** | UI/UX 原型 | Pencil/Figma MCP 生成稿 / 组件清单 / 设计规范 |
| **开发** | 编码实现 | 多 Agent 并行 / **修 bug Agentless 三段式**（Localize→Repair→Validate）/ 自主实验循环 |
| **审查** | 质量 + 安全 + 简化 | **风险 1-5 预评分**（Mythos 范式）/ 三重审查 / **Finding L1-L4 分级**（外部 oracle）/ 自动修复 |
| **交付** | 提交/发布 | 按模块分批中文 commit / 敏感信息扫描 / PR |
| **复盘** | 经验沉淀 | **四步复盘 + 能力边界记录 + crystallize_to_sop SOP 蒸馏** |

链路通过 `{cwd}/.claude/experts/handoff.md` 接力（每个专家读 handoff 知道上游做了什么，写入自己的产出，自动跳转到下一个专家）。

### 3. 记忆层（分层加载）

借鉴 GenericAgent 的 L0-L4 思路：

| 层级 | 内容 | 加载方式 |
|---|---|---|
| **L0 元规则** | `~/.claude/CLAUDE.md` | 每次会话启动全量注入 |
| **L1 索引** | `{memory_dir}/MEMORY.md` | 每轮 CC auto-memory 注入（只有索引 + 每行 hook） |
| **L2 详细内容** | 各 `*.md`（user_*/feedback_*/project_*） | 模型看索引按 `trigger` 判断是否 Read |
| **L3 可执行 SOP** | `shared/sop_*.md` / `learnings/sop_*.md` | 按 keyword/stage trigger 主动 Read |
| **L4 历史归档** | `~/.claude/projects/*/` transcripts | 搜索时才访问 |

**trigger 字段语义**（每个 memory .md 的 frontmatter）：

| 格式 | 触发条件 |
|---|---|
| `trigger: always` | 每次都按本记忆行事（索引里 hook 足够） |
| `trigger: keyword:对比\|vs` | 用户消息含关键词 |
| `trigger: project:example-project` | cwd 路径含关键字 |
| `trigger: stage:交付` | handoff 当前 stage 匹配 |

多条件用 `|` 连接（OR）。

### 4. 经验库（两级沉淀）

| 位置 | 范围 | 内容类型 |
|---|---|---|
| `{project}/.claude/experts/learnings/` | 项目级 | 本项目特有经验、backlog 回流建议 |
| `~/.claude/experts/shared/` | 跨项目 | 通用 pattern、antipattern、**可执行 SOP** |

**复盘专家的判据**（什么进 learnings，什么进 shared/sop）：

| 类型 | 形态 | 例子 |
|---|---|---|
| learnings（描述型） | 告诉读者"为什么这样做" | "别用 Edit 工具写 handoff，会展示大段 diff" |
| SOP（脚本型） | 让读者"直接跑" | "备份 ~/.claude/ 的具体 tar 命令 + exclude 列表 + 验证 + 恢复" |

### 5. 工具 MCP（扩展能力）

| MCP | 安装命令 | 用途 |
|---|---|---|
| Playwright | `claude mcp add playwright npx @playwright/mcp@latest` | Agent 用 a11y tree 操纵真实浏览器做 UI 回归 |
| Pencil | 按 Pencil 官方文档 | 生成 .pen 设计稿 |
| Figma | `claude mcp add figma ...` | 读写 Figma 设计稿 |

工具层是扩展点，按需装。专家链本身不依赖任何 MCP。

---

## 四、一次对话发生了什么（时序视图）

用户发 "帮我加一个日期字段" 到 example-form-project 项目。

| 时序 | 事件 | 位置 / 工具 | 产物 |
|---|---|---|---|
| t0 | 用户敲消息 | cmux / CC UI | — |
| t1 | CC 触发 UserPromptSubmit hook | settings.json | — |
| t1a | `router.sh` 读 handoff + 列 shared/learnings → 注入路由表 + 当前流程摘要 | stdout | Prompt 前缀注入 |
| t1b | `context-monitor.sh` 读 transcript.jsonl 的 `message.usage` → 8%（正常）→ 静默 | — | — |
| t2 | 模型看到 prompt + 注入内容，按路由表判断 "新功能" 意图 | 模型 | — |
| t3 | 调用 `Skill(experts:调研)`，加载调研专家指令 | Skill 工具 | — |
| t4 | 调研专家读 memory + learnings + shared，WebFetch 相关文档，生成方案 | Read/Grep/Agent | handoff.md 写入调研段 |
| t5 | 自动流转 `Skill(experts:设计)` | Skill 工具 | — |
| t6 | 设计专家用 Pencil MCP 出日期字段原型稿 | mcp__pencil | .pen 文件 |
| t7 | 自动流转开发专家，修改 example-form-project 代码 | Edit/Bash | 代码改动 |
| t8 | 审查专家按风险分扫描，发现 1 个 L2 finding 自动修复 | Edit | 代码修复 |
| t9 | 交付专家按模块分批 commit，写中文 message | Bash(git) | 2 个 commit |
| t10 | 复盘专家判断本次是否产生 SOP（例："给 example-form-project 加字段"是否高频?）→ 写 learnings | Write | learnings/ 新文件 |
| t11 | 复盘输出报告 + 清理 handoff | Write | handoff 标记完成 |

整个过程中：用户**只在开发阶段确认一次代码**（`feedback_confirm_before_commit` 生效），其他阶段自动流转。

---
---

## 五、参考

### 关键命令速查

| 任务 | 命令 |
|---|---|
| 验证 MCP 已装 | `claude mcp list` |
| 手动重装 wrapper | `~/.local/bin/claude-wrapper-install.sh` |
| 查 LaunchAgent 状态 | `launchctl list \| grep claude-wrapper` |
| 触发一次备份 | 见 `sop_backup-claude-config.md` |
| 查当前 session 路径 | `ls ~/.claude/projects/` |
| 查上下文 token 用量 | 看 claude-hud statusline（如已装），或手动算 transcript |

### 参考资料

- [Claude Code 官方文档](https://code.claude.com/docs)
- [GenericAgent](https://github.com/lsdefine/GenericAgent)（本体系"分层记忆 + SOP 蒸馏"灵感来源）
- [Playwright MCP](https://github.com/microsoft/playwright)（UI 自动验证）

> **想自己从零搭建？** 本体系所有细节已封装在 `install.sh` 里。要理解结构 Read 仓库根目录即可；要一键复刻 `curl -fsSL https://raw.githubusercontent.com/m13931321024-png/claude-expert-kit/main/install.sh | bash`。

---

## 致谢

本体系设计融合了：
- **Mythos Preview**（Anthropic）：审查专家的风险分级 + Finding oracle 分级
- **AISI Mythos 评估报告**：能力边界记录范式
- **GenericAgent**（lsdefine）：L0-L4 分层记忆 + SOP 蒸馏
- **Microsoft Playwright**：a11y tree 自动 UI 验证
- **Agentless**（普林斯顿）：修 bug 三段式（Localize-Repair-Validate）
- **Sonar/Big Sleep**：假设驱动审查

---

*版本：v1.0 | 更新：2026-04-20*
