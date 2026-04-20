#!/bin/bash
# claude-expert-kit uninstaller
#
# 一键远程卸载：
#   curl -fsSL https://raw.githubusercontent.com/m13931321024-png/claude-expert-kit/main/uninstall.sh | bash
#
# 本地卸载：
#   bash ~/.claude-expert-kit/uninstall.sh
#
# 环境变量：
#   DRY_RUN=1            预览不执行
#   KEEP_REPO=1          保留 ~/.claude-expert-kit/ 目录（仅移除 symlink）
#   RESTORE_BACKUP=path  指定备份目录恢复到 ~/.claude/

set -e

INSTALL_DIR="${CLAUDE_EXPERT_KIT_HOME:-$HOME/.claude-expert-kit}"
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
DRY_RUN="${DRY_RUN:-0}"
KEEP_REPO="${KEEP_REPO:-0}"
RESTORE_BACKUP="${RESTORE_BACKUP:-}"

if [ -t 1 ]; then
  R=$'\033[0;31m'; G=$'\033[0;32m'; Y=$'\033[1;33m'; B=$'\033[0;36m'; N=$'\033[0m'
else
  R=""; G=""; Y=""; B=""; N=""
fi

say() { echo "${B}→${N} $*"; }
ok()  { echo "${G}✓${N} $*"; }
warn(){ echo "${Y}⚠${N} $*"; }

run() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "  [DRY-RUN] $*"
  else
    eval "$@"
  fi
}

# 移除所有指向本 repo 的 symlink
remove_symlinks() {
  say "removing symlinks in $CLAUDE_HOME"
  local removed=0
  for path in commands/experts experts/shared hooks/expert-router hooks/context-monitor docs/introduction.md; do
    local target="$CLAUDE_HOME/$path"
    if [ -L "$target" ]; then
      local link_target
      link_target=$(readlink "$target" 2>/dev/null || true)
      case "$link_target" in
        "$INSTALL_DIR"/*)
          run "rm '$target'"
          removed=$((removed+1))
          ;;
        *)
          warn "symlink $target points elsewhere ($link_target), skip"
          ;;
      esac
    fi
  done
  ok "removed $removed symlinks"
}

# 可选：恢复备份
restore_backup() {
  if [ -z "$RESTORE_BACKUP" ]; then
    # 自动找最新备份
    local latest
    latest=$(ls -td "$HOME"/.claude.backup-* 2>/dev/null | head -1)
    if [ -n "$latest" ]; then
      warn "found backup: $latest"
      warn "to restore, run:  RESTORE_BACKUP='$latest' bash \$0"
    fi
    return
  fi
  if [ ! -d "$RESTORE_BACKUP" ]; then
    echo "backup not found: $RESTORE_BACKUP" >&2
    exit 1
  fi
  say "restoring from $RESTORE_BACKUP"
  for item in commands experts hooks docs settings.json CLAUDE.md; do
    if [ -e "$RESTORE_BACKUP/$item" ]; then
      run "cp -R '$RESTORE_BACKUP/$item' '$CLAUDE_HOME/'"
    fi
  done
  ok "restored"
}

# 卸载 wrapper
uninstall_wrapper() {
  local wrapper="$HOME/.local/bin/claude"
  local orig_target_file="$HOME/.local/bin/.claude-orig-target"
  if [ -f "$wrapper" ] && head -1 "$wrapper" 2>/dev/null | grep -q '^#!/bin/bash'; then
    say "removing claude wrapper"
    run "rm '$wrapper'"
    if [ -f "$orig_target_file" ]; then
      local orig
      orig=$(cat "$orig_target_file")
      if [ -x "$orig" ]; then
        say "restoring original claude symlink → $orig"
        run "ln -sf '$orig' '$wrapper'"
      fi
      run "rm '$orig_target_file'"
    fi
    ok "wrapper removed"
  fi
  # LaunchAgent (macOS)
  local plist="$HOME/Library/LaunchAgents/com.cc.claude-wrapper-self-heal.plist"
  if [ -f "$plist" ]; then
    say "unloading LaunchAgent"
    run "launchctl unload '$plist' 2>/dev/null || true"
    run "rm '$plist'"
  fi
}

# 删除 repo 目录
remove_repo() {
  if [ "$KEEP_REPO" = "1" ]; then
    warn "KEEP_REPO=1, preserving $INSTALL_DIR"
    return
  fi
  if [ -d "$INSTALL_DIR" ]; then
    say "removing $INSTALL_DIR"
    run "rm -rf '$INSTALL_DIR'"
    ok "repo removed"
  fi
}

main() {
  echo ""
  echo "${B}=== claude-expert-kit uninstaller ===${N}"
  echo ""
  [ "$DRY_RUN" = "1" ] && warn "DRY_RUN mode"
  echo ""

  remove_symlinks
  uninstall_wrapper
  restore_backup
  remove_repo

  echo ""
  ok "Uninstall complete."
  echo ""
  echo "Your ~/.claude/ now contains only files YOU created."
  echo "Runtime data (sessions, transcripts, memory) is untouched."
}

main "$@"
