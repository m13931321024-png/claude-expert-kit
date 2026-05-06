#!/usr/bin/env bats
# e2e: init → 拷 examples → lint → sync → chain show → status (smoke)

setup() {
  export SKILLCTL_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
  export SKILLS_REPO="$BATS_TMPDIR/e2e-skills-$$"
  export OUT="$BATS_TMPDIR/e2e-out-$$"
  export CC_SKILLS_DIR="$OUT/skills"
  export CC_COMMANDS_DIR="$OUT/commands"
  export CC_HOOKS_DIR="$OUT/hooks"
  export TRANSCRIPT_DIR="$OUT/transcripts"
  export SKILLCTL_QUIET=1
  export SKILLCTL_NO_COLOR=1
  mkdir -p "$TRANSCRIPT_DIR"
}

teardown() {
  rm -rf "$SKILLS_REPO" "$OUT"
}

@test "init creates repo skeleton" {
  run bash "$SKILLCTL_ROOT/bin/skillctl" init --dir "$SKILLS_REPO"
  [ "$status" -eq 0 ]
  [ -d "$SKILLS_REPO/experts" ]
  [ -d "$SKILLS_REPO/_internal" ]
  [ -d "$SKILLS_REPO/.git" ]
}

@test "lint passes for full canonical examples" {
  bash "$SKILLCTL_ROOT/bin/skillctl" init --dir "$SKILLS_REPO" >/dev/null 2>&1
  cp "$SKILLCTL_ROOT"/examples/canonical-skills/experts/*.md "$SKILLS_REPO/experts/"
  cp "$SKILLCTL_ROOT"/examples/canonical-skills/_internal/*.md "$SKILLS_REPO/_internal/"
  run bash "$SKILLCTL_ROOT/bin/skillctl" lint
  [ "$status" -eq 0 ]
}

@test "sync renders SlashCommand + Skill + router.json" {
  bash "$SKILLCTL_ROOT/bin/skillctl" init --dir "$SKILLS_REPO" >/dev/null 2>&1
  cp "$SKILLCTL_ROOT"/examples/canonical-skills/experts/*.md "$SKILLS_REPO/experts/"
  cp "$SKILLCTL_ROOT"/examples/canonical-skills/_internal/*.md "$SKILLS_REPO/_internal/"
  run bash "$SKILLCTL_ROOT/bin/skillctl" sync
  [ "$status" -eq 0 ]
  [ -f "$CC_HOOKS_DIR/expert-router/router.json" ]
  [ -f "$CC_COMMANDS_DIR/experts/调研.md" ]
  [ -f "$CC_SKILLS_DIR/experts/开发/SKILL.md" ]
  # router.json 应该有 6 个 expert（_internal 不进 router）
  count=$(jq '.experts | length' "$CC_HOOKS_DIR/expert-router/router.json")
  [ "$count" -eq 6 ]
}

@test "chain show works on real expert" {
  bash "$SKILLCTL_ROOT/bin/skillctl" init --dir "$SKILLS_REPO" >/dev/null 2>&1
  cp "$SKILLCTL_ROOT"/examples/canonical-skills/experts/*.md "$SKILLS_REPO/experts/"
  cp "$SKILLCTL_ROOT"/examples/canonical-skills/_internal/*.md "$SKILLS_REPO/_internal/"
  run bash "$SKILLCTL_ROOT/bin/skillctl" chain show experts:开发
  [ "$status" -eq 0 ]
  [[ "$output" == *"experts:开发"* ]]
  [[ "$output" == *"experts:审查"* ]]
}

@test "chain list returns all skills" {
  bash "$SKILLCTL_ROOT/bin/skillctl" init --dir "$SKILLS_REPO" >/dev/null 2>&1
  cp "$SKILLCTL_ROOT"/examples/canonical-skills/experts/*.md "$SKILLS_REPO/experts/"
  cp "$SKILLCTL_ROOT"/examples/canonical-skills/_internal/*.md "$SKILLS_REPO/_internal/"
  run bash "$SKILLCTL_ROOT/bin/skillctl" chain list
  [ "$status" -eq 0 ]
  [[ "$output" == *"experts:开发"* ]]
  [[ "$output" == *"_internal:autoresearch"* ]]
}

@test "status handles empty transcript dir gracefully" {
  run bash "$SKILLCTL_ROOT/bin/skillctl" status --transcript-dir "$TRANSCRIPT_DIR"
  [ "$status" -eq 0 ]
}
