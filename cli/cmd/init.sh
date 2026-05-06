#!/usr/bin/env bash
# skillctl init - initialize a private skills repo
set -euo pipefail
# shellcheck source=../lib/common.sh
source "$SKILLCTL_ROOT/cli/lib/common.sh"
# shellcheck source=../lib/git.sh
source "$SKILLCTL_ROOT/cli/lib/git.sh"

REPO_URL=""
DIR="$SKILLS_REPO_DEFAULT"
FORCE=0

usage() {
  cat <<EOF
skillctl init [options]

OPTIONS:
  --repo <url>    git remote URL (optional)
  --dir <path>    local path (default: \$HOME/skills-repo)
  --force         overwrite if exists
  -h, --help      show help

EXIT CODES:
  0  success
  1  user error (already exists / bad arg)
  2  system error (git unavailable)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO_URL="$2"; shift 2 ;;
    --dir) DIR="$2"; shift 2 ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "init: unknown option: $1" 1 ;;
  esac
done

command -v git >/dev/null 2>&1 || die "git not found in PATH" 2

if [[ -d "$DIR" && $FORCE -eq 0 ]]; then
  die "$DIR already exists. use --force to overwrite" 1
fi

[[ -d "$DIR" && $FORCE -eq 1 ]] && rm -rf "$DIR"

mkdir -p "$DIR"/{experts,_internal,_tools,.skillctl}
cd "$DIR"
git init -q

cat > .skillctl/config <<EOF
schema_version: "0.2.0"
created_at: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
EOF

cat > README.md <<'README_EOF'
# My Skills Repo
Managed by [skillctl](https://github.com/m13931321024-png/claude-expert-kit).

Layout:
- `experts/` - top-level expert skills (visible to agent)
- `_internal/` - internal skills called by experts via SlashCommand
- `_tools/` - pure tool skills

Workflow:
- edit canonical .md files under experts/ or _internal/
- `skillctl lint` - validate
- `skillctl sync` - render to ~/.claude/
- `skillctl push -m "msg"` - share via git
README_EOF

# seed with starter example if available
if [[ -f "$SKILLCTL_ROOT/examples/canonical-skills/experts/调研.md" ]]; then
  cp "$SKILLCTL_ROOT/examples/canonical-skills/experts/调研.md" "$DIR/experts/" 2>/dev/null || true
fi

if [[ -n "$REPO_URL" ]]; then
  git remote add origin "$REPO_URL"
  log "added remote origin → $REPO_URL"
fi

git add -A
git -c user.email=skillctl@local -c user.name=skillctl commit -qm "chore: skillctl init" || true

ok "initialized $DIR"
echo
echo "next steps:"
echo "  cd $DIR"
echo "  edit experts/*.md (or copy from $SKILLCTL_ROOT/examples/canonical-skills/)"
echo "  skillctl lint"
echo "  skillctl sync         # render to ~/.claude/"
[[ -n "$REPO_URL" ]] && echo "  skillctl push -m 'init'   # push to remote"
exit 0
