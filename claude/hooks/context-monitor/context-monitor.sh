#!/bin/bash
# Context Usage Monitor Hook — B1+ 模式（硬阻塞 + 暂存 + 自动续接）
# 数据源：transcript JSONL 最后一条 usage（与 claude-hud 一致）
# 行为：
#   超阈值 → 保存 prompt 到 /tmp + 输出 JSON block，强制用户 /compact
#   低阈值 + 有暂存 → 注入原 prompt 作为 additionalContext，删除暂存
#   低阈值 + 无暂存 → 静默

set -e

INPUT=$(cat)

# 提取 transcript_path / session_id / prompt
export _INPUT="$INPUT"
PARSED=$(python3 <<'PY'
import os, json
try:
    d = json.loads(os.environ["_INPUT"])
    print(d.get("transcript_path","") + "\n" + d.get("session_id","") + "\n" + d.get("prompt",""))
except Exception:
    print("\n\n")
PY
)
TRANSCRIPT=$(echo "$PARSED" | sed -n '1p')
SESSION_ID=$(echo "$PARSED" | sed -n '2p')
# prompt 可能多行，取第 3 行开始全部
PROMPT=$(echo "$PARSED" | sed -n '3,$p')

# 配置项
export _WINDOW=1000000
_THRESHOLD=40
PENDING_FILE="/tmp/cc-pending-${SESSION_ID}.txt"
PENDING_TTL_MIN=10

# ====== 计算当前使用率 ======
USED_PCT=0
USED_TOKENS=0
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  export _TRANSCRIPT="$TRANSCRIPT"
  RESULT=$(python3 <<'PY'
import os, json
path = os.environ["_TRANSCRIPT"]
window = int(os.environ["_WINDOW"])
last = None
try:
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
                msg = d.get("message") or {}
                u = msg.get("usage")
                if u:
                    last = u
            except Exception:
                pass
    if last:
        total = (last.get("input_tokens", 0)
                 + last.get("cache_creation_input_tokens", 0)
                 + last.get("cache_read_input_tokens", 0))
        pct = int(round(total * 100 / window))
        print(f"{pct}|{total}")
    else:
        print("0|0")
except Exception:
    print("0|0")
PY
)
  USED_PCT="${RESULT%|*}"
  USED_TOKENS="${RESULT#*|}"
fi

# ====== 分支 1：超阈值 → block + 暂存 ======
if [ "$USED_PCT" -ge "$_THRESHOLD" ]; then
  # 保存 prompt 到暂存文件（SESSION_ID 隔离会话）
  if [ -n "$SESSION_ID" ] && [ -n "$PROMPT" ]; then
    printf '%s' "$PROMPT" > "$PENDING_FILE"
  fi

  # 输出 block JSON
  REASON="⚠️ 上下文已达 ${USED_PCT}% (${USED_TOKENS}/${_WINDOW} tokens)，超出阈值 ${_THRESHOLD}%。

你的原消息已自动暂存。请按两步操作：
  1. 输入 /compact（或 /clear）压缩/清空上下文
  2. 随便发一条短消息（例如 'go'）触发续接 — 系统会自动恢复你的原消息交给模型处理

暂存位置：${PENDING_FILE}
暂存有效期：${PENDING_TTL_MIN} 分钟"

  export _REASON="$REASON"
  python3 -c 'import os,json; print(json.dumps({"decision":"block","reason":os.environ["_REASON"]}))'
  exit 0
fi

# ====== 分支 2：低阈值 + 有暂存 → 续接 ======
if [ -n "$SESSION_ID" ] && [ -f "$PENDING_FILE" ]; then
  # TTL 检查
  if find "$PENDING_FILE" -mmin -${PENDING_TTL_MIN} -print 2>/dev/null | grep -q .; then
    SAVED=$(cat "$PENDING_FILE")
    rm -f "$PENDING_FILE"
    # 作为 additionalContext 注入（plain text 输出会被 CC 追加到 prompt）
    cat <<CTX

[CONTEXT-RESUME] 上一轮的原始消息被上下文阈值拦截，已暂存并恢复如下。请**按此原消息执行**，忽略当前简短触发词。

--- 原消息开始 ---
$SAVED
--- 原消息结束 ---
CTX
  else
    rm -f "$PENDING_FILE"  # 过期清理
  fi
fi

exit 0
