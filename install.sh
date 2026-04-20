#!/bin/bash
# claude-expert-kit installer
#
# 一键远程安装：
#   curl -fsSL https://raw.githubusercontent.com/m13931321024-png/claude-expert-kit/main/install.sh | bash
#
# 本地安装（已 clone）：
#   git clone https://github.com/m13931321024-png/claude-expert-kit.git ~/.claude-expert-kit
#   bash ~/.claude-expert-kit/install.sh
#
# 环境变量：
#   DRY_RUN=1      预览不执行
#   FORCE=1        已有文件直接覆盖（默认会备份）
#   KIT_REPO=url   自定义 repo URL（默认官方）
#   KIT_BRANCH=x   自定义分支（默认 main）

set -e

# ========= 配置 =========
REPO_URL="${KIT_REPO:-https://github.com/m13931321024-png/claude-expert-kit.git}"
BRANCH="${KIT_BRANCH:-main}"
INSTALL_DIR="${CLAUDE_EXPERT_KIT_HOME:-$HOME/.claude-expert-kit}"
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
BACKUP_DIR="$HOME/.claude.backup-$(date +%Y%m%d-%H%M%S)"
DRY_RUN="${DRY_RUN:-0}"
FORCE="${FORCE:-0}"

# ========= 颜色 =========
if [ -t 1 ]; then
  R=$'\033[0;31m'; G=$'\033[0;32m'; Y=$'\033[1;33m'; B=$'\033[0;36m'; N=$'\033[0m'
else
  R=""; G=""; Y=""; B=""; N=""
fi

say() { echo "${B}→${N} $*"; }
ok()  { echo "${G}✓${N} $*"; }
warn(){ echo "${Y}⚠${N} $*"; }
err() { echo "${R}✗${N} $*" >&2; }

run() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "  [DRY-RUN] $*"
  else
    eval "$@"
  fi
}

# ========= 前置检查 =========
check_deps() {
  for cmd in git bash python3; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      err "missing dependency: $cmd"
      exit 1
    fi
  done
  ok "deps: git, bash, python3 OK"
}

# ========= 1. 获取 repo =========
fetch_repo() {
  if [ -f "$(dirname "$0")/claude/commands/experts/调研.md" ]; then
    INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
    say "local mode, repo at $INSTALL_DIR"
  elif [ -d "$INSTALL_DIR/.git" ]; then
    say "updating existing repo at $INSTALL_DIR"
    run "cd '$INSTALL_DIR' && git fetch --quiet origin '$BRANCH' && git reset --hard 'origin/$BRANCH'"
  else
    say "cloning $REPO_URL to $INSTALL_DIR"
    run "git clone --depth 1 --branch '$BRANCH' '$REPO_URL' '$INSTALL_DIR'"
  fi
}

# ========= 2. 备份已有 =========
backup_existing() {
  if [ ! -e "$CLAUDE_HOME" ]; then
    say "no existing $CLAUDE_HOME, skip backup"
    return
  fi
  if [ "$FORCE" = "1" ]; then
    warn "FORCE=1, skipping backup (will overwrite)"
    return
  fi
  say "backing up $CLAUDE_HOME → $BACKUP_DIR"
  run "mkdir -p '$BACKUP_DIR'"
  for item in commands experts hooks docs; do
    if [ -e "$CLAUDE_HOME/$item" ]; then
      run "cp -R '$CLAUDE_HOME/$item' '$BACKUP_DIR/'"
    fi
  done
  for item in settings.json CLAUDE.md; do
    if [ -f "$CLAUDE_HOME/$item" ]; then
      run "cp '$CLAUDE_HOME/$item' '$BACKUP_DIR/'"
    fi
  done
  ok "backup saved to $BACKUP_DIR"
}

# ========= 3. 建 ~/.claude 目录 + symlink 内容 =========
symlink_kit() {
  say "symlinking kit into $CLAUDE_HOME"
  run "mkdir -p '$CLAUDE_HOME'"

  # 清理旧 symlink（只移除指向本 repo 的，不动用户自建文件）
  for path in commands/experts experts/shared hooks/expert-router hooks/context-monitor docs; do
    target="$CLAUDE_HOME/$path"
    if [ -L "$target" ]; then
      run "rm '$target'"
    fi
  done

  # symlink 目录
  run "mkdir -p '$CLAUDE_HOME/commands' '$CLAUDE_HOME/experts' '$CLAUDE_HOME/hooks' '$CLAUDE_HOME/docs'"
  run "ln -sf '$INSTALL_DIR/claude/commands/experts' '$CLAUDE_HOME/commands/experts'"
  run "ln -sf '$INSTALL_DIR/claude/experts/shared' '$CLAUDE_HOME/experts/shared'"
  run "ln -sf '$INSTALL_DIR/claude/hooks/expert-router' '$CLAUDE_HOME/hooks/expert-router'"
  run "ln -sf '$INSTALL_DIR/claude/hooks/context-monitor' '$CLAUDE_HOME/hooks/context-monitor'"
  run "ln -sf '$INSTALL_DIR/docs/introduction.md' '$CLAUDE_HOME/docs/introduction.md'"

  ok "symlinks in place"
}

# ========= 4. 模板文件（首次才写，不覆盖用户已有）=========
seed_templates() {
  # CLAUDE.md
  if [ ! -f "$CLAUDE_HOME/CLAUDE.md" ]; then
    say "seeding CLAUDE.md template"
    run "cp '$INSTALL_DIR/CLAUDE.md.template' '$CLAUDE_HOME/CLAUDE.md'"
  else
    warn "CLAUDE.md exists, skip seed"
  fi

  # settings.json
  if [ ! -f "$CLAUDE_HOME/settings.json" ]; then
    say "seeding settings.json from example"
    run "cp '$INSTALL_DIR/settings.example.json' '$CLAUDE_HOME/settings.json'"
  else
    warn "settings.json exists, skip seed (compare with $INSTALL_DIR/settings.example.json manually)"
  fi

  # MEMORY.md index（按 cwd 生成对应 projects 目录）
  local mem_key mem_dir
  mem_key="-$(echo "${HOME#/}" | tr '/' '-')"
  mem_dir="$CLAUDE_HOME/projects/$mem_key/memory"
  if [ ! -f "$mem_dir/MEMORY.md" ]; then
    run "mkdir -p '$mem_dir'"
    run "cp '$INSTALL_DIR/examples/memory/MEMORY.md.template' '$mem_dir/MEMORY.md' 2>/dev/null || true"
    ok "seeded memory index at $mem_dir/MEMORY.md"
  fi
}

# ========= 5. 安装 wrapper（可选）=========
install_wrapper() {
  if [ "${SKIP_WRAPPER:-0}" = "1" ]; then
    warn "SKIP_WRAPPER=1, skipping wrapper install"
    return
  fi
  if [ -x "$INSTALL_DIR/bin/claude-wrapper-install.sh" ]; then
    say "installing claude wrapper (auto bypassPermissions)"
    run "bash '$INSTALL_DIR/bin/claude-wrapper-install.sh'"
  fi
}

# ========= 5.5. 安装 LaunchAgent（仅 macOS，可选）=========
install_launchagent() {
  if [ "${SKIP_LAUNCHAGENT:-0}" = "1" ]; then
    warn "SKIP_LAUNCHAGENT=1, skipping self-heal launchagent"
    return
  fi
  if [ "$(uname)" != "Darwin" ]; then
    say "not macOS, skip launchagent"
    return
  fi
  local src="$INSTALL_DIR/system/com.cc.claude-wrapper-self-heal.plist"
  local dst="$HOME/Library/LaunchAgents/com.cc.claude-wrapper-self-heal.plist"
  if [ ! -f "$src" ]; then
    warn "launchagent plist not found at $src"
    return
  fi
  say "installing LaunchAgent (wrapper self-heal every 5 min)"
  run "mkdir -p '$HOME/Library/LaunchAgents'"
  # 生成替换占位后的 plist 到目标位置（不用 sed -i，避免 Mac/GNU 差异）
  run "sed 's|__HOME__|$HOME|g' '$src' > '$dst'"
  run "launchctl unload '$dst' 2>/dev/null || true"
  run "launchctl load '$dst'"
  ok "launchagent loaded"
}

# ========= 6. doctor =========
run_doctor() {
  if [ -x "$INSTALL_DIR/doctor.sh" ]; then
    say "running health check"
    run "bash '$INSTALL_DIR/doctor.sh'"
  fi
}

# ========= main =========
main() {
  echo ""
  echo "${B}=== claude-expert-kit installer ===${N}"
  echo ""
  [ "$DRY_RUN" = "1" ] && warn "DRY_RUN mode — showing what would be done"
  echo ""

  check_deps
  fetch_repo
  backup_existing
  symlink_kit
  seed_templates
  install_wrapper
  install_launchagent
  run_doctor

  echo ""
  ok "Done. Repo: $INSTALL_DIR"
  ok "Claude home: $CLAUDE_HOME"
  [ -d "$BACKUP_DIR" ] && ok "Backup: $BACKUP_DIR"
  echo ""
  echo "Next steps:"
  echo "  1. Restart your Claude Code session to pick up new hooks/skills"
  echo "  2. Read $CLAUDE_HOME/docs/introduction.md for the full guide"
  echo "  3. Customize $CLAUDE_HOME/CLAUDE.md for your role/preferences"
  echo ""
  echo "Uninstall: bash '$INSTALL_DIR/uninstall.sh'"
}

main "$@"
