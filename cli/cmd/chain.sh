#!/usr/bin/env bash
# skillctl chain - visualize expert chain DAG
set -euo pipefail
# shellcheck source=../lib/common.sh
source "$SKILLCTL_ROOT/cli/lib/common.sh"
# shellcheck source=../lib/frontmatter.sh
source "$SKILLCTL_ROOT/cli/lib/frontmatter.sh"

usage() {
  cat <<EOF
skillctl chain show <expert-name>
skillctl chain list

Visualize an expert's chain DAG (recursive successors) or list all experts.

EXIT CODES:
  0  success
  1  expert not found / bad usage
EOF
}

[[ $# -lt 1 ]] && { usage; exit 1; }

cmd="$1"; shift

# build a map: name → file
declare -a NAMES=() FILES=()
while IFS= read -r f; do
  n=$(fm_get "$f" name 2>/dev/null || true)
  [[ -n "$n" && "$n" != "null" ]] && { NAMES+=("$n"); FILES+=("$f"); }
done < <(find "$SKILLS_REPO_DEFAULT" -name '*.md' -not -path '*/.skillctl/*' -not -name 'README.md' 2>/dev/null)

find_file_for() {
  local name="$1" i
  for i in "${!NAMES[@]}"; do
    [[ "${NAMES[$i]}" == "$name" ]] && { echo "${FILES[$i]}"; return; }
  done
}

case "$cmd" in
  list)
    for n in "${NAMES[@]:-}"; do echo "$n"; done | sort
    ;;
  show)
    [[ $# -eq 0 ]] && { err "chain show: missing expert name"; exit 1; }
    target="$1"
    f=$(find_file_for "$target")
    [[ -z "$f" ]] && { err "expert not found: $target"; exit 1; }

    # visited set 去重：每个 expert 最多展开一次（avoid chain DAG 多路径重复）
    # bash 3.2 兼容：用字符串而不是 declare -A
    VISITED=""

    print_tree() {
      local name="$1" prefix="$2" depth="$3"
      [[ $depth -gt 6 ]] && { echo "${prefix}... (max depth)"; return; }
      if echo "$VISITED" | grep -qF "|$name|"; then
        echo "${prefix}${name} (已展开过，省略子树)"
        return
      fi
      VISITED="${VISITED}|$name|"
      echo "${prefix}${name}"
      local cf
      cf=$(find_file_for "$name")
      [[ -z "$cf" ]] && return
      while IFS= read -r child; do
        [[ -z "$child" ]] && continue
        print_tree "$child" "${prefix}  → " $((depth+1))
      done < <(fm_get_list "$cf" chain)
    }

    print_tree "$target" "" 0
    ;;
  *)
    err "chain: unknown subcommand: $cmd (use 'show' or 'list')"
    exit 1
    ;;
esac
