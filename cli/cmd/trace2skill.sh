#!/usr/bin/env bash
# skillctl trace2skill - 加载 transcript 数据供 agent 分析（v0.3）
#
# 不做 LLM 分析（agent 已在 LLM 上下文中）；本工具仅做：
#   1. 找到 session transcript 文件
#   2. 提取最近 N 轮关键事件（用户输入 + agent 动作摘要）
#   3. 提取本次涉及的 skill frontmatter
#   4. 输出统一 JSON 给 agent 解读
set -euo pipefail
# shellcheck source=../lib/common.sh
source "$SKILLCTL_ROOT/cli/lib/common.sh"
# shellcheck source=../lib/frontmatter.sh
source "$SKILLCTL_ROOT/cli/lib/frontmatter.sh"

SESSION=""
LAST_N=50
TRANSCRIPT_DIR="${TRANSCRIPT_DIR:-$HOME/.claude/projects}"

usage() {
  cat <<EOF
skillctl trace2skill [options]

提取 transcript 数据 + 相关 skill frontmatter，统一 JSON 输出供 agent 分析。
被 experts:复盘 自动调用，也可手动调试。

OPTIONS:
  --session <id>      Session ID（默认：扫 \$TRANSCRIPT_DIR 取最新）
  --last <N>          仅取最后 N turn（默认 50）
  --transcript-dir    transcript 根目录（默认 ~/.claude/projects）
  -h, --help          show help

EXIT CODES:
  0  success
  1  no transcript found
  2  system error
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --session) SESSION="$2"; shift 2 ;;
    --last) LAST_N="$2"; shift 2 ;;
    --transcript-dir) TRANSCRIPT_DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "trace2skill: unknown option: $1" 1 ;;
  esac
done

[[ -d "$TRANSCRIPT_DIR" ]] || die "transcript dir not found: $TRANSCRIPT_DIR" 1

# 1. 找 transcript 文件（关 pipefail：head -1 关管道会让 xargs SIGPIPE）
set +o pipefail
if [[ -n "$SESSION" ]]; then
  log_file=$(find "$TRANSCRIPT_DIR" -name "${SESSION}*.jsonl" 2>/dev/null | head -1)
else
  log_file=$(find "$TRANSCRIPT_DIR" -name '*.jsonl' -type f 2>/dev/null | xargs ls -t 2>/dev/null | head -1)
fi
set -o pipefail

if [[ -z "$log_file" || ! -f "$log_file" ]]; then
  die "no transcript found (session: ${SESSION:-latest})" 1
fi

debug "transcript: $log_file"

# 2. 提取最后 N 个事件 + 摘要
# 每行是一个 JSON 对象（CC transcript 格式）
# 我们关心：role=user 的输入 / role=assistant 的 tool_use 摘要
total_lines=$(wc -l < "$log_file" | tr -d ' ')
start_line=$((total_lines > LAST_N ? total_lines - LAST_N : 1))

events=$(tail -n "$LAST_N" "$log_file" | jq -c '
  select(
    (.type == "user" and (.message.content | type) == "string") or
    (.type == "assistant" and (.message.content | type) == "array")
  ) |
  if .type == "user" then
    {turn: "user", text: (.message.content | tostring | .[0:300])}
  else
    {
      turn: "assistant",
      tools: [.message.content[] | select(.type == "tool_use") | .name] | unique,
      text: ([.message.content[] | select(.type == "text") | .text] | join(" ") | .[0:200])
    }
  end
' 2>/dev/null | jq -s '.' || echo "[]")

# 3. 检测涉及到的 skill（grep transcript 找出现的 experts:* / _internal:* 名）
mentioned_skills=$(grep -oE '(experts|_internal):[A-Za-z\-_一-龥]+' "$log_file" 2>/dev/null | sort -u | jq -R . | jq -s . || echo "[]")

# 4. 加载这些 skill 的当前 frontmatter
skills_data="[]"
if [[ -d "$SKILLS_REPO_DEFAULT" ]]; then
  for skill_name in $(echo "$mentioned_skills" | jq -r '.[]'); do
    slug="${skill_name#*:}"
    ns="${skill_name%%:*}"
    skill_file="$SKILLS_REPO_DEFAULT/$ns/${slug}.md"
    [[ -f "$skill_file" ]] || continue
    fm_json=$(fm_to_json "$skill_file")
    [[ -z "$fm_json" || "$fm_json" == "null" ]] && continue
    entry=$(jq -n --arg path "$skill_file" --argjson fm "$fm_json" '{path: $path, frontmatter: $fm}')
    skills_data=$(echo "$skills_data" | jq --argjson e "$entry" '. + [$e]')
  done
fi

# 5. 统一 JSON 输出（给 agent 读）
jq -n \
  --arg session "$(basename "$log_file" .jsonl)" \
  --arg total_turns "$total_lines" \
  --arg analyzed_turns "$LAST_N" \
  --argjson events "$events" \
  --argjson skills "$skills_data" \
  '{
    session: $session,
    total_turns: ($total_turns | tonumber),
    analyzed_turns: ($analyzed_turns | tonumber),
    events: $events,
    skills_in_use: $skills,
    analysis_hints: [
      "信号 1 (keywords miss): 用户输入若未在 skills_in_use[].frontmatter.keywords 中找到匹配词，建议补 keywords",
      "信号 2 (重复模式): events 中 assistant.tools 重复 ≥3 次的工具序列，建议进 expert body 任务分支",
      "信号 3 (calls 漏调): events 中实际调用的 _internal:* 若不在某 expert.calls 字段中，建议补 calls"
    ]
  }'
