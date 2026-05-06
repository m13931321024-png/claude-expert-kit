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
# 归一化用户输入：去掉空格/制表符，让 "修个 bug" 也能命中 "修bug"
normalized_input=$(echo "$USER_INPUT" | tr -d ' \t')

matched=""
while IFS= read -r line; do
  expert=$(echo "$line" | jq -r '.name')
  triggers=$(echo "$line" | jq -r '.triggers[]')
  while IFS= read -r kw; do
    [[ -z "$kw" ]] && continue
    # 字面匹配（-F）+ 大小写不敏感（-i），归一化后查 kw（也归一化）
    kw_norm=$(echo "$kw" | tr -d ' \t')
    if echo "$normalized_input" | grep -qiF "$kw_norm"; then
      matched="$expert"
      break 2
    fi
  done <<< "$triggers"
done < <(jq -c '.experts[]' "$ROUTER_JSON")

if [[ -n "$matched" ]]; then
  echo
  echo "## 🎯 强制路由"
  echo
  echo "本次输入命中 \`$matched\` 的 trigger，**必须**先调 \`Skill\` tool 触发它："
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
