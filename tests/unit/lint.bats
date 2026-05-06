#!/usr/bin/env bats

setup() {
  export SKILLCTL_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
  export SKILLS_REPO="$BATS_TMPDIR/skills-repo-$$"
  export SKILLCTL_QUIET=1
  export SKILLCTL_NO_COLOR=1
  mkdir -p "$SKILLS_REPO/experts" "$SKILLS_REPO/_internal"
}

teardown() {
  rm -rf "$SKILLS_REPO"
}

@test "lint passes for valid expert skill" {
  cat > "$SKILLS_REPO/experts/foo.md" << 'EOF'
---
name: experts:foo
type: expert
description: a valid expert
---
body
EOF
  run bash "$SKILLCTL_ROOT/bin/skillctl" lint "$SKILLS_REPO/experts/foo.md"
  [ "$status" -eq 0 ]
}

@test "lint fails on missing required field 'description'" {
  cat > "$SKILLS_REPO/experts/bad.md" << 'EOF'
---
name: experts:bad
type: expert
---
EOF
  run bash "$SKILLCTL_ROOT/bin/skillctl" lint "$SKILLS_REPO/experts/bad.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"missing required field 'description'"* ]]
}

@test "lint fails on chain referencing unknown skill" {
  cat > "$SKILLS_REPO/experts/aaa.md" << 'EOF'
---
name: experts:aaa
type: expert
description: ok
chain: [experts:nonexistent]
---
EOF
  run bash "$SKILLCTL_ROOT/bin/skillctl" lint "$SKILLS_REPO/experts/aaa.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"chain references unknown skill"* ]]
}

@test "lint fails on bad type enum value" {
  cat > "$SKILLS_REPO/experts/badtype.md" << 'EOF'
---
name: experts:badtype
type: wizard
description: ok
---
EOF
  run bash "$SKILLCTL_ROOT/bin/skillctl" lint "$SKILLS_REPO/experts/badtype.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"type must be one of"* ]]
}

@test "lint warns when description exceeds 200 chars" {
  long=$(printf 'a%.0s' {1..220})
  cat > "$SKILLS_REPO/experts/long.md" << EOF
---
name: experts:long
type: expert
description: $long
---
EOF
  run bash "$SKILLCTL_ROOT/bin/skillctl" lint "$SKILLS_REPO/experts/long.md"
  [ "$status" -eq 0 ]
  [[ "$output" == *"will be truncated"* ]]
}
