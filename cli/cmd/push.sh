#!/usr/bin/env bash
# skillctl push - commit and push
set -euo pipefail
# shellcheck source=../lib/common.sh
source "$SKILLCTL_ROOT/cli/lib/common.sh"
# shellcheck source=../lib/git.sh
source "$SKILLCTL_ROOT/cli/lib/git.sh"

MSG=""
DRY_RUN=0

usage() {
  cat <<EOF
skillctl push [-m MSG] [--dry-run]

Stage all changes, commit, push to remote.

EXIT CODES:
  0  success
  1  nothing to commit / no remote
  2  push failed
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m) MSG="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "push: unknown option: $1" 1 ;;
  esac
done

[[ -d "$SKILLS_REPO_DEFAULT/.git" ]] || die "not a skills repo: $SKILLS_REPO_DEFAULT" 1
git_has_remote "$SKILLS_REPO_DEFAULT" || die "no remote (run 'git -C $SKILLS_REPO_DEFAULT remote add origin <url>')" 1

if ! git_dirty "$SKILLS_REPO_DEFAULT" \
   && [[ $(git_in "$SKILLS_REPO_DEFAULT" log "@{u}.." --oneline 2>/dev/null | wc -l | tr -d ' ') -eq 0 ]]; then
  warn "nothing to commit and nothing to push"
  exit 1
fi

[[ -z "$MSG" ]] && MSG="chore: skill update $(date +%Y-%m-%d)"

if [[ $DRY_RUN -eq 1 ]]; then
  log "[dry-run] git add . && git commit -m \"$MSG\" && git push"
  git_in "$SKILLS_REPO_DEFAULT" status --short
  exit 0
fi

git_in "$SKILLS_REPO_DEFAULT" add -A
if git_dirty "$SKILLS_REPO_DEFAULT"; then
  git_in "$SKILLS_REPO_DEFAULT" commit -m "$MSG" || true
fi
git_in "$SKILLS_REPO_DEFAULT" push || die "push failed (auth? network? branch protection?)" 2

ok "pushed"
