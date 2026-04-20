#!/bin/bash
# claude-expert-kit health check
#
# 验证：symlink 指向、依赖存在、settings 有效、hooks 可执行

set -e

INSTALL_DIR="${CLAUDE_EXPERT_KIT_HOME:-$HOME/.claude-expert-kit}"
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"

if [ -t 1 ]; then
  R=$'\033[0;31m'; G=$'\033[0;32m'; Y=$'\033[1;33m'; N=$'\033[0m'
else
  R=""; G=""; Y=""; N=""
fi

pass=0
fail=0
warn_count=0

check() {
  local label="$1" cond="$2"
  if eval "$cond"; then
    echo "  ${G}✓${N} $label"
    pass=$((pass+1))
  else
    echo "  ${R}✗${N} $label"
    fail=$((fail+1))
  fi
}

warn_check() {
  local label="$1" cond="$2"
  if eval "$cond"; then
    echo "  ${G}✓${N} $label"
    pass=$((pass+1))
  else
    echo "  ${Y}⚠${N} $label"
    warn_count=$((warn_count+1))
  fi
}

echo ""
echo "=== Claude Expert Kit — Doctor ==="
echo ""

echo "[dependencies]"
check "git available"       "command -v git >/dev/null"
check "bash available"      "command -v bash >/dev/null"
check "python3 available"   "command -v python3 >/dev/null"
check "claude binary"       "command -v claude >/dev/null"
warn_check "gh CLI installed" "command -v gh >/dev/null"

echo ""
echo "[kit repo]"
check "repo dir exists"          "[ -d '$INSTALL_DIR' ]"
check "has claude/ subdir"       "[ -d '$INSTALL_DIR/claude' ]"
check "has 6 experts"            "[ \$(ls '$INSTALL_DIR/claude/commands/experts' 2>/dev/null | wc -l) -ge 6 ]"
check "has shared experiences"   "[ \$(ls '$INSTALL_DIR/claude/experts/shared' 2>/dev/null | wc -l) -ge 5 ]"
check "has hooks"                "[ -x '$INSTALL_DIR/claude/hooks/expert-router/router.sh' ]"

echo ""
echo "[symlinks in ~/.claude]"
for path in commands/experts experts/shared hooks/expert-router hooks/context-monitor; do
  target="$CLAUDE_HOME/$path"
  if [ -L "$target" ]; then
    link_target=$(readlink "$target")
    case "$link_target" in
      "$INSTALL_DIR"/*)
        echo "  ${G}✓${N} $path → $link_target"
        pass=$((pass+1))
        ;;
      *)
        echo "  ${Y}⚠${N} $path points elsewhere: $link_target"
        warn_count=$((warn_count+1))
        ;;
    esac
  else
    echo "  ${R}✗${N} $path not a symlink (or missing)"
    fail=$((fail+1))
  fi
done

echo ""
echo "[configuration]"
check "settings.json exists"  "[ -f '$CLAUDE_HOME/settings.json' ]"
warn_check "CLAUDE.md exists" "[ -f '$CLAUDE_HOME/CLAUDE.md' ]"
if [ -f "$CLAUDE_HOME/settings.json" ]; then
  check "settings.json is valid JSON" "python3 -c 'import json; json.load(open(\"$CLAUDE_HOME/settings.json\"))' 2>/dev/null"
fi

echo ""
echo "[wrapper (optional)]"
if [ -f "$HOME/.local/bin/claude" ]; then
  if head -1 "$HOME/.local/bin/claude" 2>/dev/null | grep -q '^#!/bin/bash'; then
    echo "  ${G}✓${N} claude wrapper installed"
    pass=$((pass+1))
  else
    echo "  ${Y}⚠${N} ~/.local/bin/claude is a binary, not wrapper (run: bash $INSTALL_DIR/bin/claude-wrapper-install.sh)"
    warn_count=$((warn_count+1))
  fi
fi

echo ""
echo "=== Summary ==="
echo "  ${G}✓ Passed: $pass${N}"
[ "$warn_count" -gt 0 ] && echo "  ${Y}⚠ Warnings: $warn_count${N}"
if [ "$fail" -gt 0 ]; then
  echo "  ${R}✗ Failed: $fail${N}"
  echo ""
  echo "Issues found. Re-run install: bash $INSTALL_DIR/install.sh"
  exit 1
fi
echo ""
echo "All good."
