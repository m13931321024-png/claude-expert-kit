#!/bin/bash
# Expert Router Hook v2 — UserPromptSubmit
#
# v0.2 升级：动态读取 router.json（由 skillctl sync 生成），不再写死路由表。
# 新增 expert 后只需 'skillctl sync' 即生效，无需改 hook。
#
# 用法（替换 v0.1）：
#   1. 备份：mv ~/.claude/hooks/expert-router/router.sh ~/.claude/hooks/expert-router/router.sh.v0.1.bak
#   2. 拷贝：cp examples/hooks/router-v2.sh ~/.claude/hooks/expert-router/router.sh
#   3. chmod +x ~/.claude/hooks/expert-router/router.sh
#   4. 重启 CC

ROUTER_JSON="${HOME}/.claude/hooks/expert-router/router.json"
HANDOFF_FILE="${PWD}/.claude/experts/handoff.md"
USER_INPUT=$(cat)  # UserPromptSubmit 把用户输入通过 stdin 传入

# fallback：router.json 不存在则退化为 v0.1 行为（仅注入静态路由头）
if [[ ! -f "$ROUTER_JSON" ]]; then
  cat <<'STATIC_HEADER'
[EXPERT-SYSTEM-ROUTER]
你拥有一个闭环专家体系，按用户意图自动路由 experts:* skill。
（router.json 未找到，请运行 'skillctl sync' 生成）
STATIC_HEADER
  exit 0
fi

# 1. 注入 EXPERT-SYSTEM-ROUTER 头（动态从 router.json 拼装）
echo "[EXPERT-SYSTEM-ROUTER]"
echo
echo "你拥有一个闭环专家体系。可用 expert 列表："
echo

jq -r '.experts[] | "- /\(.name) (priority: \(.priority // "medium"), triggers: \(.triggers | join(",")))"' "$ROUTER_JSON" 2>/dev/null

# 2. 关键词命中强制路由
# v0.2.1：路由用 router.json 的 keywords 字段（单一来源）
# v0.3：加 fuzzy 子序列匹配 — "加个新功能" 也能命中 "加功能" / "新功能"
normalized_input=$(echo "$USER_INPUT" | tr -d ' \t' | tr '[:upper:]' '[:lower:]')

# 子序列匹配：kw 中字符按顺序出现在 input 即算命中
# 例：kw="加功能" + input="加个新功能" → 顺序找 加→功→能 → 命中
fuzzy_match() {
  local kw="$1" input="$2"
  local i=0 j=0 kw_len=${#kw} in_len=${#input}
  [[ $kw_len -eq 0 ]] && return 1
  while [[ $i -lt $in_len && $j -lt $kw_len ]]; do
    if [[ "${input:$i:1}" == "${kw:$j:1}" ]]; then
      j=$((j+1))
    fi
    i=$((i+1))
  done
  [[ $j -eq $kw_len ]]
}

matched=""
match_kind=""
# 第一轮：字面匹配（精度高）
while IFS= read -r line; do
  expert=$(echo "$line" | jq -r '.name')
  keywords=$(echo "$line" | jq -r '(.keywords // .triggers // [])[]?')
  while IFS= read -r kw; do
    [[ -z "$kw" ]] && continue
    kw_norm=$(echo "$kw" | tr -d ' \t' | tr '[:upper:]' '[:lower:]')
    if echo "$normalized_input" | grep -qF "$kw_norm"; then
      matched="$expert"
      match_kind="literal"
      break 2
    fi
  done <<< "$keywords"
done < <(jq -c '.experts[]' "$ROUTER_JSON")

# 第二轮：子序列 fuzzy 匹配（仅在字面无命中时；要求 kw 长度 ≥3 防误判）
if [[ -z "$matched" ]]; then
  while IFS= read -r line; do
    expert=$(echo "$line" | jq -r '.name')
    keywords=$(echo "$line" | jq -r '(.keywords // .triggers // [])[]?')
    while IFS= read -r kw; do
      [[ -z "$kw" ]] && continue
      kw_norm=$(echo "$kw" | tr -d ' \t' | tr '[:upper:]' '[:lower:]')
      [[ ${#kw_norm} -lt 3 ]] && continue
      if fuzzy_match "$kw_norm" "$normalized_input"; then
        matched="$expert"
        match_kind="fuzzy"
        break 2
      fi
    done <<< "$keywords"
  done < <(jq -c '.experts[]' "$ROUTER_JSON")
fi

if [[ -n "$matched" ]]; then
  echo
  echo "## 🎯 强制路由"
  echo
  echo "本次输入命中 \`$matched\` 的 keyword（${match_kind}），**必须**先调 \`Skill\` tool 触发它："
  echo "\`\`\`"
  echo "Skill: $matched"
  echo "\`\`\`"
  echo "调用前不要总结、不要预先回答，直接路由。"

  # 同时注入 chain 信息让后续专家自动接力
  chain=$(jq -r --arg n "$matched" '.experts[] | select(.name == $n) | .chain | join(" → ")' "$ROUTER_JSON")
  if [[ -n "$chain" && "$chain" != "null" ]]; then
    echo
    echo "完成后链路：$matched → $chain"
  fi
fi

# 3. 注入 handoff 摘要（如存在）
if [[ -f "$HANDOFF_FILE" ]]; then
  echo
  echo "## 当前项目进行中的流程（摘要）"
  echo '```'
  awk '/^---$/{c++; if(c==2){exit}} c>=1' "$HANDOFF_FILE" | head -40
  echo "[...完整内容请 Read $HANDOFF_FILE]"
  echo '```'
fi

exit 0
