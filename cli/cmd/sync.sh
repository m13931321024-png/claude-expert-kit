#!/usr/bin/env bash
# skillctl sync - render canonical skills to claude-code targets
set -euo pipefail
# shellcheck source=../lib/common.sh
source "$SKILLCTL_ROOT/cli/lib/common.sh"
# shellcheck source=../lib/frontmatter.sh
source "$SKILLCTL_ROOT/cli/lib/frontmatter.sh"

DRY_RUN=0
TARGET="claude-code"

usage() {
  cat <<EOF
skillctl sync [options]

OPTIONS:
  --dry-run                       show actions, don't write files
  --target <claude-code|codex>    output target (default: claude-code)
  -h, --help                      show help

EXIT CODES:
  0  success
  1  validation failed (run skillctl lint first)
  2  write error
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --target) TARGET="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "sync: unknown option: $1" 1 ;;
  esac
done

case "$TARGET" in
  claude-code|codex) : ;;
  *) die "sync: unsupported target '$TARGET' (use claude-code or codex)" 1 ;;
esac
[[ -d "$SKILLS_REPO_DEFAULT" ]] || die "skills repo not found: $SKILLS_REPO_DEFAULT (run 'skillctl init')" 1

log "running lint..."
if ! bash "$SKILLCTL_ROOT/cli/cmd/lint.sh" >/dev/null 2>&1; then
  err "sync aborted: lint failed. run 'skillctl lint' for details"
  exit 1
fi

count=0
router_entries="[]"

while IFS= read -r f; do
  fm=$(fm_extract "$f")
  body=$(body_extract "$f")
  json=$(echo "$fm" | yq eval -o=json -)

  name=$(echo "$json" | jq -r '.name')
  type=$(echo "$json" | jq -r '.type // "expert"')
  # use jq slicing (codepoint-safe for UTF-8) instead of bash byte slicing
  desc=$(echo "$json" | jq -r '.description | .[0:200]')

  slug="${name#*:}"
  ns="${name%%:*}"

  cmd_dir="$CC_COMMANDS_DIR/$ns"
  cmd_file="$cmd_dir/${slug}.md"
  skill_dir="$CC_SKILLS_DIR/$ns/$slug"
  skill_file="$skill_dir/SKILL.md"

  # build trimmed CC-friendly frontmatter
  cc_fm=$(echo "$json" | jq --arg desc "$desc" -c '
    {
      name,
      description: $desc,
      triggers: (.triggers // null),
      priority: (.priority // null)
    } | with_entries(select(.value != null))
  ' | yq eval -P - 2>/dev/null)

  if [[ "$TARGET" == "claude-code" ]]; then
    if [[ $DRY_RUN -eq 1 ]]; then
      log "[dry-run] $cmd_file"
      log "[dry-run] $skill_file"
    else
      mkdir -p "$cmd_dir" "$skill_dir"
      {
        echo "---"
        echo "$cc_fm"
        echo "---"
        echo
        echo "$body"
      } > "$cmd_file"
      cp "$cmd_file" "$skill_file"
      debug "wrote $cmd_file + $skill_file"
    fi
  elif [[ "$TARGET" == "codex" ]]; then
    # Codex adapter (alpha): canonical → ~/.codex/agents/<ns>/<slug>.md
    # 仅渲染 name + description + body（Codex 无 Skill / SlashCommand 之分）
    codex_dir="${CODEX_AGENTS_DIR:-$HOME/.codex/agents}/$ns"
    codex_file="$codex_dir/${slug}.md"
    if [[ $DRY_RUN -eq 1 ]]; then
      log "[dry-run] $codex_file"
    else
      mkdir -p "$codex_dir"
      {
        echo "# $name"
        echo
        echo "> $desc"
        echo
        echo "$body"
      } > "$codex_file"
      debug "wrote $codex_file (codex adapter alpha)"
    fi
  fi

  if [[ "$type" == "expert" ]]; then
    # router uses keywords field as single source of truth (v0.2.1)
    # legacy: if frontmatter still has 'triggers', merge them in for backward compat
    entry=$(echo "$json" | jq -c '{
      name,
      priority: (.priority // "medium"),
      keywords: (
        (.keywords // []) +
        (if (.triggers // null) | type == "string" then ((.triggers // "") | split("|") | map(select(length > 0)))
         elif (.triggers // null) | type == "array" then .triggers
         else [] end)
        | unique
      ),
      chain: (.chain // []),
      calls: (.calls // [])
    }')
    router_entries=$(echo "$router_entries" | jq --argjson e "$entry" '. + [$e]')
  fi

  count=$((count+1))
done < <(find "$SKILLS_REPO_DEFAULT" -name '*.md' -not -path '*/.skillctl/*' -not -name 'README.md')

router_dir="$CC_HOOKS_DIR/expert-router"
router_file="$router_dir/router.json"
router_json=$(jq -n \
  --arg version "0.2.0" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson experts "$router_entries" \
  '{version: $version, generated_at: $ts, experts: $experts}')

if [[ $DRY_RUN -eq 1 ]]; then
  log "[dry-run] $router_file"
  echo "$router_json" | jq .
else
  mkdir -p "$router_dir"
  echo "$router_json" > "$router_file"
fi

ok "synced $count skill(s) → $TARGET"
[[ $DRY_RUN -eq 1 ]] || ok "router config: $router_file"
exit 0
