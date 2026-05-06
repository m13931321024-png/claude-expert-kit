#!/usr/bin/env bash
# skillctl lint - validate canonical skill files
set -euo pipefail
# shellcheck source=../lib/common.sh
source "$SKILLCTL_ROOT/cli/lib/common.sh"
# shellcheck source=../lib/frontmatter.sh
source "$SKILLCTL_ROOT/cli/lib/frontmatter.sh"

usage() {
  cat <<EOF
skillctl lint [PATH...]

Validate canonical skill .md files against schema/skill.schema.json.
If no PATH given, lints all *.md under SKILLS_REPO ($SKILLS_REPO_DEFAULT).

EXIT CODES:
  0  all valid
  1  validation errors
  2  schema or system error
EOF
}

PATHS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    -*) die "lint: unknown option: $1" 1 ;;
    *) PATHS+=("$1"); shift ;;
  esac
done

if [[ ${#PATHS[@]} -eq 0 ]]; then
  if [[ -d "$SKILLS_REPO_DEFAULT" ]]; then
    while IFS= read -r f; do PATHS+=("$f"); done \
      < <(find "$SKILLS_REPO_DEFAULT" -name '*.md' -not -path '*/.skillctl/*' -not -name 'README.md')
  else
    die "no paths given and \$SKILLS_REPO_DEFAULT ($SKILLS_REPO_DEFAULT) does not exist" 1
  fi
fi

[[ ${#PATHS[@]} -eq 0 ]] && { warn "no .md files to lint"; exit 0; }

SCHEMA="$SKILLCTL_ROOT/schema/skill.schema.json"
[[ -f "$SCHEMA" ]] || die "schema not found: $SCHEMA" 2

# pre-pass: collect every name for cross-ref check
declare -a ALL_NAMES=()
for f in "${PATHS[@]}"; do
  n=$(fm_get "$f" name 2>/dev/null || true)
  [[ -n "$n" && "$n" != "null" ]] && ALL_NAMES+=("$n")
done

errors=0
checked=0
for f in "${PATHS[@]}"; do
  checked=$((checked+1))
  fm=$(fm_extract "$f")
  if [[ -z "$fm" ]]; then
    err "$f: missing frontmatter"
    errors=$((errors+1))
    continue
  fi

  json=$(echo "$fm" | yq eval -o=json - 2>/dev/null || echo "")
  if [[ -z "$json" ]]; then
    err "$f: invalid YAML frontmatter"
    errors=$((errors+1))
    continue
  fi

  # required fields
  for field in name type description; do
    val=$(echo "$json" | jq -r ".$field // empty")
    if [[ -z "$val" ]]; then
      err "$f: missing required field '$field'"
      errors=$((errors+1))
    fi
  done

  # type enum
  type=$(echo "$json" | jq -r '.type // empty')
  case "$type" in
    expert|internal|tool|"") : ;;
    *) err "$f: type must be one of [expert,internal,tool], got '$type'"; errors=$((errors+1)) ;;
  esac

  # description length
  desc=$(echo "$json" | jq -r '.description // empty')
  if [[ ${#desc} -gt 200 ]]; then
    warn "$f: description ${#desc} chars > 200; will be truncated on sync"
  fi

  # name format: namespace:slug (allows CJK)
  name=$(echo "$json" | jq -r '.name // empty')
  if [[ -n "$name" ]]; then
    # must contain exactly one colon between namespace and slug
    if [[ ! "$name" == *:* ]] || [[ "$name" =~ ::|^:|:$ ]]; then
      err "$f: name must match 'namespace:slug' format, got '$name'"
      errors=$((errors+1))
    fi
  fi

  # chain refs must exist
  while IFS= read -r ref; do
    [[ -z "$ref" ]] && continue
    found=0
    for known in "${ALL_NAMES[@]:-}"; do
      [[ "$known" == "$ref" ]] && { found=1; break; }
    done
    if [[ $found -eq 0 ]]; then
      err "$f: chain references unknown skill '$ref'"
      errors=$((errors+1))
    fi
  done < <(echo "$json" | jq -r '.chain[]? // empty')

  # calls refs must exist
  while IFS= read -r ref; do
    [[ -z "$ref" ]] && continue
    found=0
    for known in "${ALL_NAMES[@]:-}"; do
      [[ "$known" == "$ref" ]] && { found=1; break; }
    done
    if [[ $found -eq 0 ]]; then
      err "$f: calls references unknown skill '$ref'"
      errors=$((errors+1))
    fi
  done < <(echo "$json" | jq -r '.calls[]? // empty')

done

if [[ $errors -gt 0 ]]; then
  err "lint failed: $errors error(s) in $checked file(s)"
  exit 1
fi

ok "lint passed: $checked file(s) valid"
exit 0
