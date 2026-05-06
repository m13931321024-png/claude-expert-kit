#!/usr/bin/env bash
# skillctl pull - git pull + auto-sync
set -euo pipefail
# shellcheck source=../lib/common.sh
source "$SKILLCTL_ROOT/cli/lib/common.sh"
# shellcheck source=../lib/git.sh
source "$SKILLCTL_ROOT/cli/lib/git.sh"

REBASE=0

usage() {
  cat <<EOF
skillctl pull [--rebase]

Fetch from remote and auto-run 'skillctl sync'.

EXIT CODES:
  0  success
  1  conflict (resolve manually then run 'skillctl sync')
  2  sync failed
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rebase) REBASE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "pull: unknown option: $1" 1 ;;
  esac
done

[[ -d "$SKILLS_REPO_DEFAULT/.git" ]] || die "not a skills repo: $SKILLS_REPO_DEFAULT" 1
git_has_remote "$SKILLS_REPO_DEFAULT" || die "no remote configured" 1

if [[ $REBASE -eq 1 ]]; then
  git_in "$SKILLS_REPO_DEFAULT" pull --rebase || die "pull conflict; resolve manually then 'skillctl sync'" 1
else
  git_in "$SKILLS_REPO_DEFAULT" pull || die "pull conflict; resolve manually" 1
fi

log "auto-syncing..."
bash "$SKILLCTL_ROOT/cli/cmd/sync.sh" || die "sync failed after pull" 2

ok "pull + sync complete"
