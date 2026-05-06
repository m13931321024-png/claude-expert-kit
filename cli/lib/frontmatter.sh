# frontmatter.sh - extract / parse YAML frontmatter
# shellcheck shell=bash

# extract frontmatter as YAML (stdout); empty if no frontmatter
fm_extract() {
  local file="$1"
  awk '/^---$/{c++; next} c==1{print} c==2{exit}' "$file"
}

# extract body (everything after the second ---)
body_extract() {
  local file="$1"
  awk '/^---$/{c++; next} c>=2{print}' "$file"
}

# get a field value via yq (e.g., fm_get FILE name)
fm_get() {
  local file="$1" field="$2"
  fm_extract "$file" | yq eval ".${field} // \"\"" - 2>/dev/null
}

# get list field as newline-separated values
fm_get_list() {
  local file="$1" field="$2"
  fm_extract "$file" | yq eval ".${field}[] // \"\"" - 2>/dev/null
}

# convert frontmatter to compact JSON via yq
fm_to_json() {
  local file="$1"
  fm_extract "$file" | yq eval -o=json - 2>/dev/null
}
