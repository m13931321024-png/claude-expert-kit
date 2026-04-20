#!/bin/bash
# Self-healing installer: 重装 claude wrapper（CC 自动更新会覆盖 symlink，此脚本恢复 wrapper）
# 幂等：已是 wrapper 时跳过

WRAPPER="$HOME/.local/bin/claude"
VERSIONS_DIR="$HOME/.local/share/claude/versions"

# 如果已是 bash wrapper 就跳过
if [ -f "$WRAPPER" ] && head -1 "$WRAPPER" 2>/dev/null | grep -q '^#!/bin/bash'; then
  exit 0
fi

# 找最新版本
LATEST=""
if [ -d "$VERSIONS_DIR" ]; then
  LATEST=$(ls -1 "$VERSIONS_DIR" 2>/dev/null | sort -V | tail -1)
fi

if [ -z "$LATEST" ]; then
  echo "[wrapper-install] no claude versions found in $VERSIONS_DIR" >&2
  exit 1
fi

# 备份当前 symlink 目标
if [ -L "$WRAPPER" ]; then
  readlink "$WRAPPER" > $HOME/.local/bin/.claude-orig-target
fi

# 移除原 symlink/binary
rm -f "$WRAPPER"

# 写 wrapper
cat > "$WRAPPER" <<'WRAPPER_EOF'
#!/bin/bash
# Auto-wrapper for claude CLI: inject --permission-mode bypassPermissions for non-interactive sessions
# 用户带 --permission-mode 或 --dangerously-skip-permissions 则不注入

VERSIONS_DIR="$HOME/.local/share/claude/versions"

# 动态解析最新版本
REAL=""
if [ -d "$VERSIONS_DIR" ]; then
  LATEST=$(ls -1 "$VERSIONS_DIR" 2>/dev/null | sort -V | tail -1)
  [ -n "$LATEST" ] && REAL="$VERSIONS_DIR/$LATEST"
fi

if [ -z "$REAL" ] || [ ! -x "$REAL" ]; then
  if [ -f $HOME/.local/bin/.claude-orig-target ]; then
    REAL=$(cat $HOME/.local/bin/.claude-orig-target)
  fi
fi

if [ ! -x "$REAL" ]; then
  echo "claude wrapper: cannot find real claude binary" >&2
  exit 127
fi

# 检查用户是否已传权限相关参数
HAS_PM=0
for arg in "$@"; do
  case "$arg" in
    --permission-mode|--permission-mode=*)
      HAS_PM=1; break ;;
    --dangerously-skip-permissions|--allow-dangerously-skip-permissions)
      HAS_PM=1; break ;;
  esac
done

if [ "$HAS_PM" = "1" ]; then
  exec "$REAL" "$@"
else
  exec "$REAL" --permission-mode bypassPermissions "$@"
fi
WRAPPER_EOF

chmod +x "$WRAPPER"
echo "[wrapper-install] wrapper installed at $WRAPPER → $VERSIONS_DIR/$LATEST"
