# common.sh - shared utilities for skillctl
# shellcheck shell=bash

if [[ -t 2 && -z "${SKILLCTL_NO_COLOR:-}" ]]; then
  C_RED=$'\033[31m'; C_YEL=$'\033[33m'; C_BLU=$'\033[34m'
  C_GRN=$'\033[32m'; C_DIM=$'\033[2m'; C_RST=$'\033[0m'
else
  C_RED=''; C_YEL=''; C_BLU=''; C_GRN=''; C_DIM=''; C_RST=''
fi

log()    { [[ -z "${SKILLCTL_QUIET:-}" ]] && echo "${C_BLU}[skillctl]${C_RST} $*" >&2 || true; }
warn()   { echo "${C_YEL}[warn]${C_RST} $*" >&2; }
err()    { echo "${C_RED}[error]${C_RST} $*" >&2; }
ok()     { [[ -z "${SKILLCTL_QUIET:-}" ]] && echo "${C_GRN}✓${C_RST} $*" >&2 || true; }
debug()  { [[ -n "${SKILLCTL_VERBOSE:-}" ]] && echo "${C_DIM}[debug]${C_RST} $*" >&2 || true; }

die() { err "$1"; exit "${2:-1}"; }

check_deps() {
  local missing=()
  for dep in "$@"; do
    command -v "$dep" >/dev/null 2>&1 || missing+=("$dep")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    err "missing dependencies: ${missing[*]}"
    echo "  install with: brew install ${missing[*]}" >&2
    exit 2
  fi
}

# canonical paths (overridable via env)
SKILLS_REPO_DEFAULT="${SKILLS_REPO:-$HOME/skills-repo}"
CC_SKILLS_DIR="${CC_SKILLS_DIR:-$HOME/.claude/skills}"
CC_COMMANDS_DIR="${CC_COMMANDS_DIR:-$HOME/.claude/commands}"
CC_HOOKS_DIR="${CC_HOOKS_DIR:-$HOME/.claude/hooks}"

export SKILLS_REPO_DEFAULT CC_SKILLS_DIR CC_COMMANDS_DIR CC_HOOKS_DIR
