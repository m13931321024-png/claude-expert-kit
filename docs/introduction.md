# Claude Code 专家体系 — 从零搭建到日常使用

> 一份让任何 CC 用户能在 1 小时内把默认 CC 改造成"6 专家闭环 + 分层记忆 + 自动沉淀 SOP"的工程化 AI 工作流的完整指南。

---

## 目录

- [一、为什么要造这套](#一为什么要造这套)
- [二、一图看懂](#二一图看懂)
- [三、五大系统详解](#三五大系统详解)
- [四、一次对话发生了什么](#四一次对话发生了什么时序视图)
- [五、从零搭建（11 步可复制）](#五从零搭建11-步可复制)
- [六、默认 CC vs 本体系 对照](#六默认-cc-vs-本体系-对照)
- [七、FAQ](#七faq)
- [八、附录：关键文件速查](#八附录关键文件速查)

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

## 五、从零搭建（11 步可复制）

### 前提

- macOS / Linux（Windows WSL 也行）
- 已安装 Claude Code CLI（`claude` 命令可用）
- 已登录 Anthropic 账号
- Python 3 可用（给 hook 解析 JSON）

### Step 1: 建目录结构

```bash
mkdir -p ~/.claude/commands/experts
mkdir -p ~/.claude/experts/shared
mkdir -p ~/.claude/hooks/expert-router
mkdir -p ~/.claude/hooks/context-monitor
mkdir -p ~/.claude/docs

# CWD-based memory dir（CC 会读这个）
MEM_KEY=$(echo "-$HOME" | tr '/' '-')
mkdir -p "$HOME/.claude/projects/${MEM_KEY}/memory"
```

### Step 2: 写全局 CLAUDE.md

```bash
cat > ~/.claude/CLAUDE.md <<'EOF'
# Global CLAUDE.md

全局生效的行为约束和知识沉淀。此文件每次会话自动加载。

## Harness

跨项目错误/经验沉淀。格式：
- [YYYY-MM-DD] 场景: xxx。根因: yyy。预防: zzz

<!-- harness-entries-below -->
EOF
```

### Step 3: 写 Router Hook

```bash
cat > ~/.claude/hooks/expert-router/router.sh <<'ROUTER_EOF'
#!/bin/bash
HANDOFF_FILE="${PWD}/.claude/experts/handoff.md"
LEARNINGS_DIR="${PWD}/.claude/experts/learnings"
SHARED_DIR="${HOME}/.claude/experts/shared"

cat << 'EXPERT_ROUTING'
[EXPERT-SYSTEM-ROUTER]

你拥有一个闭环专家体系。对用户的每条消息，按以下规则处理：

## 路由判断

**不启动专家**：闲聊/问答/配置 CC/调用 /xxx skill

**启动专家**（用户要做事）：

| 意图 | 起始专家 | 链路 |
|------|---------|------|
| 新功能/新页面 | 调研 | 调研→设计→开发→审查→交付→复盘 |
| 设计/UI | 设计 | 设计→开发→审查→交付→复盘 |
| 修 bug | 开发 | 开发→审查→交付→复盘 |
| 优化/重构 | 调研 | 调研→开发→审查→交付→复盘 |
| 提交/PR | 交付 | 交付→复盘 |
| 复盘/总结 | 复盘 | 复盘 |
| 调研/选型 | 调研 | 调研→复盘 |

## 执行规则

1. 自动匹配（不问"要不要用专家"）
2. 用 Skill 工具调 experts:{专家名}
3. 链式自动流转，handoff.md 接力
4. 链路末尾自动复盘

## 视觉打扰控制（重要）

写 handoff.md / learnings/*.md / experts/shared/*.md 时：
- 禁止 Edit 工具（会展示 diff）
- 禁止 Write 覆盖已有文件（同样 diff）
- 用 Bash rm + Write 创建新文件，或 Bash heredoc 写临时文件再 mv

EXPERT_ROUTING

# 注入 handoff 摘要（前 30 行）
if [ -f "$HANDOFF_FILE" ]; then
  echo ""
  echo "## 当前项目进行中的流程（摘要）"
  echo '```'
  head -n 30 "$HANDOFF_FILE"
  echo ""
  echo "[...详细内容省略。完整 handoff 路径：$HANDOFF_FILE，需要时自行 Read...]"
  echo '```'
fi

# 列经验文件
if [ -d "$LEARNINGS_DIR" ] && [ "$(ls -A "$LEARNINGS_DIR" 2>/dev/null)" ]; then
  echo ""
  echo "## 本项目已有经验"
  ls -1 "$LEARNINGS_DIR" 2>/dev/null | head -10
fi

if [ -d "$SHARED_DIR" ] && [ "$(ls -A "$SHARED_DIR" 2>/dev/null)" ]; then
  echo ""
  echo "## 跨项目共享经验"
  ls -1 "$SHARED_DIR" 2>/dev/null | head -10
fi
ROUTER_EOF

chmod +x ~/.claude/hooks/expert-router/router.sh
```

### Step 4: 写 Context Monitor Hook

```bash
cat > ~/.claude/hooks/context-monitor/context-monitor.sh <<'MON_EOF'
#!/bin/bash
set -e

INPUT=$(cat)
export _INPUT="$INPUT"

PARSED=$(python3 <<'PY'
import os, json
try:
    d = json.loads(os.environ["_INPUT"])
    print(d.get("transcript_path","") + "\n" + d.get("session_id","") + "\n" + d.get("prompt",""))
except Exception:
    print("\n\n")
PY
)
TRANSCRIPT=$(echo "$PARSED" | sed -n '1p')
SESSION_ID=$(echo "$PARSED" | sed -n '2p')
PROMPT=$(echo "$PARSED" | sed -n '3,$p')

export _WINDOW=1000000   # 改成你模型的 context window
_THRESHOLD=40
PENDING_FILE="/tmp/cc-pending-${SESSION_ID}.txt"
PENDING_TTL_MIN=10

USED_PCT=0
USED_TOKENS=0
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  export _TRANSCRIPT="$TRANSCRIPT"
  RESULT=$(python3 <<'PY'
import os, json
path = os.environ["_TRANSCRIPT"]
window = int(os.environ["_WINDOW"])
last = None
try:
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line: continue
            try:
                d = json.loads(line)
                msg = d.get("message") or {}
                u = msg.get("usage")
                if u: last = u
            except: pass
    if last:
        total = (last.get("input_tokens",0) + last.get("cache_creation_input_tokens",0) + last.get("cache_read_input_tokens",0))
        print(f"{int(round(total*100/window))}|{total}")
    else:
        print("0|0")
except:
    print("0|0")
PY
)
  USED_PCT="${RESULT%|*}"
  USED_TOKENS="${RESULT#*|}"
fi

# 超阈值：block + 暂存
if [ "$USED_PCT" -ge "$_THRESHOLD" ]; then
  if [ -n "$SESSION_ID" ] && [ -n "$PROMPT" ]; then
    printf '%s' "$PROMPT" > "$PENDING_FILE"
  fi
  REASON="⚠️ 上下文已达 ${USED_PCT}% (${USED_TOKENS}/${_WINDOW} tokens)，超阈值 ${_THRESHOLD}%。

原消息已暂存。请：
  1. 输入 /compact（压缩）或 /clear（清空）
  2. 随便发一条短消息（如 'go'）触发续接 — 系统自动恢复原消息

暂存: ${PENDING_FILE} (TTL ${PENDING_TTL_MIN} 分钟)"

  export _REASON="$REASON"
  python3 -c 'import os,json; print(json.dumps({"decision":"block","reason":os.environ["_REASON"]}))'
  exit 0
fi

# 低阈值 + 有暂存：续接
if [ -n "$SESSION_ID" ] && [ -f "$PENDING_FILE" ]; then
  if find "$PENDING_FILE" -mmin -${PENDING_TTL_MIN} -print 2>/dev/null | grep -q .; then
    SAVED=$(cat "$PENDING_FILE")
    rm -f "$PENDING_FILE"
    cat <<CTX

[CONTEXT-RESUME] 上一轮原始消息被拦截并暂存，已恢复如下。请按此原消息执行，忽略当前简短触发词。

--- 原消息开始 ---
$SAVED
--- 原消息结束 ---
CTX
  else
    rm -f "$PENDING_FILE"
  fi
fi

exit 0
MON_EOF

chmod +x ~/.claude/hooks/context-monitor/context-monitor.sh
```

### Step 5: 配置 settings.json

```bash
cat > ~/.claude/settings.json <<'EOF'
{
  "env": {},
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "bash $HOME/.claude/hooks/expert-router/router.sh", "timeout": 5 },
          { "type": "command", "command": "bash $HOME/.claude/hooks/context-monitor/context-monitor.sh", "timeout": 3 }
        ]
      }
    ]
  },
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Write(**/.claude/**)",
      "Edit(**/.claude/**)",
      "Write(**/handoff.md)",
      "Edit(**/handoff.md)"
    ]
  }
}
EOF
```

### Step 6: 写 6 个专家 skill

每个专家一个 `~/.claude/commands/experts/{name}.md`。结构相同：

```markdown
---
name: experts:{name}
description: {作用一句话}
triggers: {关键词列表，|分隔}
priority: high
---

# {name} 专家

## 启动协议
1. 读 handoff.md
2. 读 learnings / shared

## 工具箱
- {具体工具}

## 工作流程
Step 1: ...
Step 2: ...

## 输出协议
更新 handoff.md → 自动进入下一个专家
```

**六个专家的完整文本**（600-1500 字各）可以从已有实现复制，这里只列关键字段：

| 文件名 | triggers 关键词 | 核心工作流 |
|---|---|---|
| 调研.md | `调研\|需求\|选型\|方案\|research` | 澄清 → 现状分析 → 方案对比表 → 输出结论 |
| 设计.md | `设计\|UI\|界面\|原型\|design` | 读需求 → 生成稿 → 组件清单 → 设计规范 |
| 开发.md | `开发\|实现\|修 bug\|refactor\|implement` | 任务拆解 → 并行/修 bug 三段式 → 验证 |
| 审查.md | `审查\|review\|质量\|安全\|simplify` | 风险预评分 → 三重审查 → Finding 分级 → 自动修复 |
| 交付.md | `交付\|提交\|commit\|push\|PR\|deploy` | 变更分析 → 安全扫描 → 分批中文 commit → 验证 |
| 复盘.md | `复盘\|回顾\|总结\|经验\|沉淀\|retro` | 四步复盘 → 能力边界 → SOP 蒸馏 → 清理 handoff |

### Step 7: 安装 Wrapper（免权限弹窗）

```bash
cat > ~/.local/bin/claude-wrapper-install.sh <<'INSTALL_EOF'
#!/bin/bash
WRAPPER="$HOME/.local/bin/claude"
VERSIONS_DIR="$HOME/.local/share/claude/versions"

# 已是 wrapper 就跳过
if [ -f "$WRAPPER" ] && head -1 "$WRAPPER" 2>/dev/null | grep -q '^#!/bin/bash'; then
  exit 0
fi

LATEST=$(ls -1 "$VERSIONS_DIR" 2>/dev/null | sort -V | tail -1)
[ -z "$LATEST" ] && exit 1

rm -f "$WRAPPER"
cat > "$WRAPPER" <<'WEOF'
#!/bin/bash
VERSIONS_DIR="$HOME/.local/share/claude/versions"
LATEST=$(ls -1 "$VERSIONS_DIR" 2>/dev/null | sort -V | tail -1)
REAL="$VERSIONS_DIR/$LATEST"
[ ! -x "$REAL" ] && { echo "claude binary not found" >&2; exit 127; }
HAS_PM=0
for arg in "$@"; do
  case "$arg" in
    --permission-mode|--permission-mode=*|--dangerously-skip-permissions|--allow-dangerously-skip-permissions)
      HAS_PM=1; break ;;
  esac
done
[ "$HAS_PM" = "1" ] && exec "$REAL" "$@" || exec "$REAL" --permission-mode bypassPermissions "$@"
WEOF

chmod +x "$WRAPPER"
INSTALL_EOF

chmod +x ~/.local/bin/claude-wrapper-install.sh
~/.local/bin/claude-wrapper-install.sh
```

**macOS 加 LaunchAgent 每 5 分钟自愈**（CC 升级会覆盖 wrapper）：

```bash
cat > ~/Library/LaunchAgents/com.cc.claude-wrapper-self-heal.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cc.claude-wrapper-self-heal</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>__HOME__/.local/bin/claude-wrapper-install.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF
sed -i '' "s|__HOME__|$HOME|g" ~/Library/LaunchAgents/com.cc.claude-wrapper-self-heal.plist
launchctl load ~/Library/LaunchAgents/com.cc.claude-wrapper-self-heal.plist
```

### Step 8: 装常用 MCP

```bash
# UI 自动验证（推荐）
claude mcp add playwright npx @playwright/mcp@latest

# 按需
# claude mcp add figma ...
# claude mcp add pencil ...
```

### Step 9: 初始化 memory

```bash
MEM_DIR="$HOME/.claude/projects/$(echo "-$HOME" | tr '/' '-')/memory"
cat > "$MEM_DIR/MEMORY.md" <<'EOF'
# Memory Index

> 每条记忆的 `trigger` 标注何时 Read 详细内容。语义详见 `~/.claude/experts/shared/memory-trigger-convention.md`。

## 按 trigger 分组

### always（每轮必读）
（随着使用累积，由助手自动添加）

### keyword 触发
（同上）

### project 触发
（同上）
EOF
```

**trigger 约定文档**（给助手和其他使用者看）：

```bash
cat > ~/.claude/experts/shared/memory-trigger-convention.md <<'EOF'
---
name: Memory Trigger 约定
date: YYYY-MM-DD
type: context
trigger: always
---

# Memory Trigger 约定

每条 memory 的 `trigger:` 字段支持四种格式，`|` 分隔多个（OR）：

| 格式 | 含义 |
|---|---|
| `always` | 每轮都按此记忆行事（索引里 hook 足够，不需 Read） |
| `keyword:X` | 用户消息含关键词（正则） |
| `project:X` | cwd 路径含关键字 |
| `stage:X` | handoff current_stage 等于 X |

模型看 MEMORY.md 索引时按 trigger 判断是否 Read 详细 .md。
EOF
```

### Step 10: 初始化 SOP 模板

```bash
cat > ~/.claude/experts/shared/sop_template.md <<'EOF'
---
sop: <task_type_kebab_case>
date: YYYY-MM-DD
trigger: keyword:|stage:|project:
prerequisites: [前置条件]
source: <本 SOP 从哪次任务蒸馏>
---

# SOP: <任务类型一句话>

## 何时用
一句话判断"是我要的吗"

## 输入（必备信息）
- [ ] 输入 1
- [ ] 输入 2

## 步骤

### Step 1: <动作>
**操作**:
\`\`\`bash
<可直接跑的命令>
\`\`\`
**验收**: <如何知道成功>

### Step 2: ...

## 整体验收标准
- [ ] 标准 1
- [ ] 标准 2

## 失败回滚
{如何撤销}

## 可复用片段（Copy-Paste 区）
\`\`\`bash
# 片段...
\`\`\`

## 演进记录
- YYYY-MM-DD 初版
EOF
```

### Step 11: 首次备份

```bash
STAMP=$(date +%Y-%m-%d-%H%M)
mkdir -p ~/.claude-backups
tar czf ~/.claude-backups/claude-backup-$STAMP.tar.gz \
  --exclude='.claude/telemetry' --exclude='.claude/cache' \
  --exclude='.claude/paste-cache' --exclude='.claude/session-env' \
  --exclude='.claude/sessions' --exclude='.claude/shell-snapshots' \
  --exclude='.claude/todos' --exclude='.claude/downloads' \
  --exclude='.claude/file-history' --exclude='.claude/history.jsonl' \
  --exclude='.claude/plugins/cache' --exclude='.claude/plugins/marketplaces' \
  --exclude='.claude/plugins/data' --exclude='.claude/plugins/pua' \
  --exclude='.claude/backups' --exclude='.claude/stats-cache.json' \
  -C ~/ .claude
echo "✓ Backup: ~/.claude-backups/claude-backup-$STAMP.tar.gz"
```

### 完成

重启 CC 会话，发一句 "加一个页面" 试试。正常应该看到模型自动走"调研"专家。

---

## 六、默认 CC vs 本体系 对照

| 痛点 | 默认 CC | 本体系 |
|---|---|---|
| 同样需求响应不一致 | 模型自由发挥 | Router 固定链路 + 路由表 |
| 每次确认权限 | 每次弹 | Wrapper bypassPermissions 全跳过 |
| 上下文溢出无预警 | 静默或突然 compact | 40% 硬阻塞 + 暂存重放 |
| 经验散落 | commit message + 脑子 | learnings + shared + SOP 三级沉淀 |
| 同类任务从零 | 每次重述背景 | handoff 接力 + memory 自动加载 |
| UI 验证靠手 | 用户自己打开浏览器 | Playwright MCP a11y tree 操纵 |
| 升级丢配置 | 手动排查 | LaunchAgent 自愈 + tar 备份 SOP |
| memory 全量注入 | 10 条就几 K token | trigger 分层 + 模型按需 Read |
| 多项目知识孤岛 | 每个项目独立 | shared/ 跨项目经验池 |
| 无法判断任务边界 | 模糊任务一口气做完 | 六专家分阶段，每阶段验收 |

---

## 七、FAQ

**Q1：一定要六个专家都用吗？**
不一定。"简单任务快速走"原则允许跳过阶段，比如改一行代码 = 开发→交付→复盘。Router 会智能跳过，不强制全链路。

**Q2：我不想用 cmux 怎么办？**
cmux 只是 CC 的 session 管理器（可选）。本体系完全不依赖 cmux，直接用 `claude` CLI 或 Desktop App 都行。Wrapper 脚本两种方式都兼容。

**Q3：bypassPermissions 不危险吗？**
权限模式默认值是出于保守设计。如果你了解自己的工作流、且配置了合理的 `allow` 列表，bypass 是可接受的。不放心的话改成 `acceptEdits`（只自动过编辑类权限）。

**Q4：专家 md 是我自己写？**
推荐从已有实现复制起步（GitHub 上有这套的完整配置包），然后按自己习惯调。专家 md 的结构是模板，核心是"启动协议 + 工作流程 + 输出协议"。

**Q5：memory trigger 字段 CC 原生支持吗？**
**不支持**。当前靠模型看索引时的自觉判断（路由注入里会提示）。未来若 CC 支持原生 trigger，hook 层可升级为自动过滤。

**Q6：这套可以跟 cursor/cline/其他工具共存吗？**
可以。本体系只改 `~/.claude/` 和 `~/.local/bin/claude`，对其他工具无影响。

**Q7：如何升级/维护？**
- 每次大改前跑 `sop_backup-claude-config.md` 里的备份命令
- CC 自动更新 wrapper 会被 LaunchAgent 恢复
- 新增经验由复盘专家自动写 shared/learnings
- 定期扫 shared/ 如果 >30 个文件考虑按主题合并

**Q8：能在 Windows 用吗？**
LaunchAgent 是 macOS 的。Windows 可用 Task Scheduler 替代。bash 脚本要 WSL 或 Git Bash。hook 逻辑不变。

---

## 八、附录：关键文件速查

### 目录树

```
~/.claude/
├── CLAUDE.md                          # L0 全局约束
├── settings.json                      # hooks + permissions 挂载
├── settings.local.json                # 本机私有设置
├── commands/experts/                  # 6 个专家 skill
│   ├── 调研.md
│   ├── 设计.md
│   ├── 开发.md
│   ├── 审查.md
│   ├── 交付.md
│   └── 复盘.md
├── experts/
│   └── shared/                        # 跨项目经验 + SOP
│       ├── sop_template.md
│       ├── sop_backup-claude-config.md
│       ├── memory-trigger-convention.md
│       └── {各种 pattern/antipattern}.md
├── hooks/
│   ├── expert-router/router.sh        # 专家路由注入
│   └── context-monitor/               # 40% 阻塞
│       └── context-monitor.sh
├── projects/{cwd_hash}/memory/        # L1-L2 记忆
│   ├── MEMORY.md                      # 索引
│   ├── user_*.md                      # 身份/偏好
│   ├── feedback_*.md                  # 行为约束
│   └── project_*.md                   # 项目事实
└── docs/introduction.md               # 本文档

~/.local/bin/
├── claude                             # Bash wrapper
└── claude-wrapper-install.sh          # 自愈重装脚本

~/Library/LaunchAgents/                # macOS only
└── com.cc.claude-wrapper-self-heal.plist

~/.claude-backups/                     # 备份档案
└── claude-backup-*.tar.gz
```

### 关键命令速查

| 任务 | 命令 |
|---|---|
| 验证 MCP 已装 | `claude mcp list` |
| 手动重装 wrapper | `~/.local/bin/claude-wrapper-install.sh` |
| 查 LaunchAgent 状态 | `launchctl list \| grep claude-wrapper` |
| 触发一次备份 | 见 Step 11 / `sop_backup-claude-config.md` |
| 查当前 session 路径 | `ls ~/.claude/projects/` |
| 查上下文 token 用量 | 看 claude-hud statusline（如已装），或手动算 transcript |

### 参考资料

- [Claude Code 官方文档](https://code.claude.com/docs)
- [GenericAgent](https://github.com/lsdefine/GenericAgent)（本体系"分层记忆 + SOP 蒸馏"灵感来源）
- [Playwright MCP](https://github.com/microsoft/playwright)（UI 自动验证）

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

*版本：v1.0 | 更新：YYYY-MM-DD | 贡献：填你名字*
