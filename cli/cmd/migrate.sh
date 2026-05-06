#!/usr/bin/env bash
# skillctl migrate - migrate v0.1 commands/experts/*.md to canonical
set -euo pipefail
# shellcheck source=../lib/common.sh
source "$SKILLCTL_ROOT/cli/lib/common.sh"
# shellcheck source=../lib/frontmatter.sh
source "$SKILLCTL_ROOT/cli/lib/frontmatter.sh"

FROM_VERSION="v0.1"
DRY_RUN=0
FORCE=0
SOURCE_DIR="${HOME}/.claude/commands/experts"

usage() {
  cat <<EOF
skillctl migrate [options]

Migrate v0.1 ~/.claude/commands/experts/*.md to canonical at SKILLS_REPO/experts/.
Idempotent: re-run safely; existing target with newer version is kept.
v0.1 source files are NOT deleted (rollback always possible).

OPTIONS:
  --from <version>   source version (default: v0.1)
  --source <path>    source dir (default: ~/.claude/commands/experts)
  --dry-run          show actions, don't write
  --force            re-migrate even if target newer/equal
  -h, --help         show help

EXIT CODES:
  0  success
  1  user error / nothing to migrate
  2  system error
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from) FROM_VERSION="$2"; shift 2 ;;
    --source) SOURCE_DIR="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "migrate: unknown option: $1" 1 ;;
  esac
done

[[ -d "$SOURCE_DIR" ]] || die "source dir not found: $SOURCE_DIR" 1
[[ -d "$SKILLS_REPO_DEFAULT" ]] || die "skills repo not found: $SKILLS_REPO_DEFAULT (run 'skillctl init' first)" 1

target_dir="$SKILLS_REPO_DEFAULT/experts"
mkdir -p "$target_dir"

# semver compare: returns 0 if a >= b
ver_ge() {
  [[ "$1" == "$2" ]] && return 0
  printf '%s\n%s\n' "$1" "$2" | sort -V -C 2>/dev/null
}

migrated=0; skipped=0; upgraded=0; conflicts=0
report=()

while IFS= read -r src; do
  base=$(basename "$src")
  target="$target_dir/$base"
  src_fm=$(fm_extract "$src")
  src_body=$(body_extract "$src")
  src_json=$(echo "$src_fm" | yq eval -o=json - 2>/dev/null || echo "{}")

  src_name=$(echo "$src_json" | jq -r '.name // empty')
  if [[ -z "$src_name" ]]; then
    err "$src: missing 'name' frontmatter, skipping"
    conflicts=$((conflicts+1))
    report+=("conflict: $base (no name)")
    continue
  fi

  # build canonical frontmatter: merge with v0.2 defaults
  canonical_json=$(echo "$src_json" | jq '
    . + {
      type: (.type // "expert"),
      version: (.version // "0.2.0"),
      platforms: (.platforms // ["claude-code"]),
      chain: (.chain // []),
      calls: (.calls // []),
      keywords: (.keywords // [])
    }
  ')

  if [[ -f "$target" ]]; then
    tgt_fm=$(fm_extract "$target")
    tgt_ver=$(echo "$tgt_fm" | yq eval '.version // "0.0.0"' - 2>/dev/null || echo "0.0.0")
    src_ver=$(echo "$canonical_json" | jq -r '.version')
    if [[ $FORCE -eq 0 ]] && ver_ge "$tgt_ver" "$src_ver"; then
      skipped=$((skipped+1))
      report+=("skipped: $base (target $tgt_ver >= source $src_ver)")
      continue
    fi
    # backup
    if [[ $DRY_RUN -eq 0 ]]; then
      ts=$(date +%Y%m%d-%H%M%S)
      cp "$target" "$target.bak.$ts"
      debug "backup: $target.bak.$ts"
    fi
    upgraded=$((upgraded+1))
    report+=("upgraded: $base ($tgt_ver → $src_ver)")
  else
    migrated=$((migrated+1))
    report+=("migrated: $base")
  fi

  if [[ $DRY_RUN -eq 1 ]]; then
    log "[dry-run] would write: $target"
  else
    canonical_fm=$(echo "$canonical_json" | yq eval -P - 2>/dev/null)
    {
      echo "---"
      echo "$canonical_fm"
      echo "---"
      echo
      echo "$src_body"
    } > "$target"
  fi
done < <(find "$SOURCE_DIR" -maxdepth 1 -name '*.md' | sort)

echo
log "migration report:"
for line in "${report[@]:-}"; do
  echo "  $line"
done
echo
ok "migrate: $migrated migrated, $upgraded upgraded, $skipped skipped, $conflicts conflict(s)"

if [[ $DRY_RUN -eq 0 && $migrated -gt 0 || $upgraded -gt 0 ]]; then
  echo
  echo "next: skillctl lint && skillctl sync"
fi

[[ $conflicts -gt 0 ]] && exit 1
exit 0
