#!/usr/bin/env bash
# skillctl link - symlink skills repo into ~/.claude/
set -euo pipefail
# shellcheck source=../lib/common.sh
source "$SKILLCTL_ROOT/cli/lib/common.sh"

ACTIVATE=0
FORCE=0

usage() {
  cat <<EOF
skillctl link [options]

Symlink \$SKILLS_REPO/{experts,_internal} into ~/.claude/skills/{experts,_internal}.
Useful for live editing: changes in repo immediately visible to CC without 'sync'.

NOTE: For most workflows, prefer 'skillctl sync' (copy mode) — link mode skips
the rendering step and CC sees raw canonical files.

OPTIONS:
  --activate    create the symlinks (without this, only print what would happen)
  --force       overwrite existing files/links at target
  -h, --help    show help

EXIT CODES:
  0  success
  1  target exists (use --force) / repo missing
  2  system error
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --activate) ACTIVATE=1; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "link: unknown option: $1" 1 ;;
  esac
done

[[ -d "$SKILLS_REPO_DEFAULT" ]] || die "skills repo not found: $SKILLS_REPO_DEFAULT" 1

mkdir -p "$CC_SKILLS_DIR"

for ns in experts _internal; do
  src="$SKILLS_REPO_DEFAULT/$ns"
  tgt="$CC_SKILLS_DIR/$ns"

  [[ -d "$src" ]] || { debug "skip $ns (no source dir)"; continue; }

  if [[ -e "$tgt" || -L "$tgt" ]]; then
    if [[ $FORCE -eq 0 ]]; then
      err "$tgt already exists. use --force to overwrite"
      exit 1
    fi
    if [[ $ACTIVATE -eq 1 ]]; then
      rm -rf "$tgt"
    fi
  fi

  if [[ $ACTIVATE -eq 1 ]]; then
    ln -s "$src" "$tgt"
    ok "linked: $tgt → $src"
  else
    log "[plan] ln -s $src $tgt"
  fi
done

if [[ $ACTIVATE -eq 0 ]]; then
  echo
  echo "(use --activate to actually create symlinks)"
fi
exit 0
