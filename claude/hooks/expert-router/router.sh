#!/bin/bash
# Expert Router Hook
# 在每次用户输入时注入专家系统路由指令
# 读取当前项目的 handoff 状态，提供上下文

HANDOFF_FILE="${PWD}/.claude/experts/handoff.md"
LEARNINGS_DIR="${PWD}/.claude/experts/learnings"
SHARED_DIR="${HOME}/.claude/experts/shared"

# 构建路由指令
cat << 'EXPERT_ROUTING'
[EXPERT-SYSTEM-ROUTER]

你拥有一个闭环专家体系。对用户的每条消息，按以下规则自动处理：

## 路由判断

先判断用户意图类型：

**不启动专家的情况：**
- 闲聊、问好、简单问答（"这个函数是干什么的"）
- 配置 Claude Code 本身（hooks、settings、keybindings）
- 明确调用其他 skill（/xxx）

**启动专家的情况 — 用户要你做事：**

| 用户意图 | 起始专家 | 完整链路 |
|---------|---------|---------|
| 新功能/新页面/从0开始 | 调研 | 调研→设计→开发→审查→交付→复盘 |
| 设计/UI/界面/原型 | 设计 | 设计→开发→审查→交付→复盘 |
| 修bug/修复/报错/崩溃 | 开发 | 开发→审查→交付→复盘 |
| 优化/重构/性能 | 调研 | 调研→开发→审查→交付→复盘 |
| 提交/发布/上线/PR | 交付 | 交付→复盘 |
| 复盘/总结/回顾 | 复盘 | 复盘 |
| 调研/选型/方案对比 | 调研 | 调研→复盘 |
| 学习/研究某技术 | 调研 | 调研→复盘 |

## 执行规则

1. **自动匹配** — 不要问用户"要不要用专家"，直接判断并执行
2. **读取专家文件** — 用 Skill 工具调用 `experts:{专家名}` 加载专家指令
3. **链式自动流转** — 一个专家完成后自动进入下一个，中间不停顿
4. **handoff 传递** — 通过 handoff.md 在专家间传递上下文
5. **最终复盘** — 链路末尾自动复盘沉淀经验
6. **简单任务快速走** — 改个文案这种，30秒开发→审查→交付→复盘，不要搞复杂

## 跳过环节

不是每个任务都要走全链路。智能跳过：
- 改一行代码 → 开发→交付→复盘（跳过审查）
- 纯文档改动 → 交付→复盘
- 探索性调研 → 调研→复盘（不需要开发）

## 视觉打扰控制（重要）

写 `handoff.md` / `learnings/*.md` / `experts/shared/*.md` 等专家内部状态文件时：

- **禁止使用 Edit 工具** —— 会展示大段 diff 占据用户屏幕
- **禁止使用 Write 工具覆盖已有文件** —— 同样展示 diff
- **必须使用 Bash heredoc 写临时文件再 mv**：

  ```bash
  cat > /tmp/handoff-new.md << 'HANDOFF_EOF'
  ...完整内容...
  HANDOFF_EOF
  mv /tmp/handoff-new.md .claude/experts/handoff.md
  ```

  Bash 工具结果只显示简短命令摘要，不展开 diff。

- **新建文件（目标尚不存在）可用 Write** —— Write 新建只显示 "File created"，无 diff。

- **首选行为**：更新 handoff 前先用 Bash `rm -f handoff.md` 删除旧文件，再用 Write 创建新文件。这样仍无 diff。

EXPERT_ROUTING

# 如果存在 handoff，只注入 frontmatter 摘要（避免长内容污染 context）
if [ -f "$HANDOFF_FILE" ]; then
  echo ""
  echo "## 当前项目进行中的流程（摘要）"
  echo '```'
  # 只取前 30 行（通常包含 frontmatter + 任务摘要）
  head -n 30 "$HANDOFF_FILE"
  echo ""
  echo "[...详细内容省略。完整 handoff 路径：$HANDOFF_FILE，需要时自行 Read...]"
  echo '```'
  echo ""
  echo "注意：上面是进行中的流程摘要，如用户新输入相关则继续该流程；若需完整上下文，Read 上面的 handoff 路径。"
fi

# 如果存在本地经验，提示可用
if [ -d "$LEARNINGS_DIR" ] && [ "$(ls -A "$LEARNINGS_DIR" 2>/dev/null)" ]; then
  echo ""
  echo "## 本项目已有经验"
  echo "目录 ${LEARNINGS_DIR} 下有经验文件，专家启动时应读取参考。"
  ls -1 "$LEARNINGS_DIR" 2>/dev/null | head -10
fi

# 如果存在共享经验，提示可用
if [ -d "$SHARED_DIR" ] && [ "$(ls -A "$SHARED_DIR" 2>/dev/null)" ]; then
  echo ""
  echo "## 跨项目共享经验"
  echo "目录 ${SHARED_DIR} 下有通用经验，专家启动时可选择性参考（不强制应用）。"
  ls -1 "$SHARED_DIR" 2>/dev/null | head -10
fi
