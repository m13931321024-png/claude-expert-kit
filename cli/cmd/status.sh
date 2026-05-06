#!/usr/bin/env bash
# skillctl status - 调用率监控（v0.3）
# 扫 ~/.claude/projects/*.jsonl 统计 expert 调用频次 + 路由覆盖率
set -euo pipefail
# shellcheck source=../lib/common.sh
source "$SKILLCTL_ROOT/cli/lib/common.sh"

LAST_DAYS=7
TRANSCRIPT_DIR="${TRANSCRIPT_DIR:-$HOME/.claude/projects}"

usage() {
  cat <<EOF
skillctl status [options]

扫最近 N 天 transcript，输出 expert 调用频次 + 路由命中率（粗估）。

OPTIONS:
  --days <N>          统计窗口（默认 7 天）
  --transcript-dir    transcript 目录（默认 ~/.claude/projects）
  -h, --help          show help

EXIT CODES:
  0  success
  1  no transcript / repo not found
  2  system error
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --days) LAST_DAYS="$2"; shift 2 ;;
    --transcript-dir) TRANSCRIPT_DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "status: unknown option: $1" 1 ;;
  esac
done

[[ -d "$TRANSCRIPT_DIR" ]] || die "transcript dir not found: $TRANSCRIPT_DIR" 1

# 找 LAST_DAYS 内修改过的 jsonl
set +o pipefail
files=$(find "$TRANSCRIPT_DIR" -name '*.jsonl' -type f -mtime -"$LAST_DAYS" 2>/dev/null)
set -o pipefail

if [[ -z "$files" ]]; then
  warn "no transcripts in last $LAST_DAYS days under $TRANSCRIPT_DIR"
  exit 0
fi

session_count=$(echo "$files" | wc -l | tr -d ' ')
log "scanning $session_count session(s) in last $LAST_DAYS days..."

# 统计 expert 出现次数（bash 3.2 兼容：用临时文件 + sort/uniq 替代 declare -A）
expert_log=$(mktemp)
trap 'rm -f "$expert_log"' EXIT

total_user_prompts=0
sessions_with_expert=0

for f in $files; do
  user_n=$(grep -c '"type":"user"' "$f" 2>/dev/null || echo 0)
  total_user_prompts=$((total_user_prompts + user_n))

  has_expert=0
  while IFS= read -r exp; do
    [[ -z "$exp" ]] && continue
    echo "$exp" >> "$expert_log"
    has_expert=1
  done < <(grep -oE 'experts:[A-Za-z\-_一-龥]+' "$f" 2>/dev/null | sort -u)

  [[ $has_expert -eq 1 ]] && sessions_with_expert=$((sessions_with_expert + 1))
done

coverage=$(awk -v n=$sessions_with_expert -v t=$session_count 'BEGIN{ if(t>0) printf "%.0f", (n/t)*100; else print 0 }')

echo
echo "=== skillctl status ($LAST_DAYS days) ==="
echo "  sessions:        $session_count"
echo "  user prompts:    $total_user_prompts"
echo "  expert coverage: ${coverage}% ($sessions_with_expert / $session_count sessions)"
echo
echo "=== expert 调用频次（按 session 计 unique） ==="
if [[ ! -s "$expert_log" ]]; then
  echo "  (none)"
else
  sort "$expert_log" | uniq -c | sort -rn | awk '{ printf "  %-25s %d sessions\n", $2, $1 }'
fi

echo
echo "=== 路由健康提示 ==="
if [[ $coverage -lt 50 ]]; then
  warn "expert coverage <50% — 大半 session 没走 expert 路由"
  echo "  → 可能：keywords 不够全 / 任务多为闲聊不应路由"
  echo "  → 跑 'skillctl trace2skill' 在某个未路由 session 上看 keywords miss"
elif [[ $coverage -lt 80 ]]; then
  ok "expert coverage ${coverage}% — 中等"
  echo "  → 改进：把 status 输出粘给 trace2skill 找未命中的 session 分析"
else
  ok "expert coverage ${coverage}% — 健康 ≥80%"
fi
