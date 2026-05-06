# git.sh - git wrapper helpers
# shellcheck shell=bash

git_in() {
  local dir="$1"; shift
  git -C "$dir" "$@"
}

git_is_repo()    { git_in "$1" rev-parse --git-dir >/dev/null 2>&1; }
git_has_remote() { [[ -n "$(git_in "$1" remote 2>/dev/null)" ]]; }
git_dirty()      { [[ -n "$(git_in "$1" status --porcelain 2>/dev/null)" ]]; }
