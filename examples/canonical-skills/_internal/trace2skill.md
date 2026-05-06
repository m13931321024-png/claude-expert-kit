---
name: _internal:trace2skill
type: internal
description: 从任务 transcript 提炼 skill 升级建议（被复盘专家调用）
keywords: [trace2skill, skill 升级, 经验回流, transcript 分析]
version: 0.3.0
platforms: [claude-code]
maintainer: 加州
---

# trace2skill

从任务 transcript 中提炼"该改哪条 skill"的建议。被 `experts:复盘` 自动调用。

## 输入
- `--session <id>` 当前会话 ID（CC 自动从 transcript 路径找）
- `--last <N>` 仅看最后 N 轮（默认 50，避免长 trace 爆 token）

## 步骤
1. 调 `skillctl trace2skill --session $ID --last 50`
2. 命令输出：
   - 本次 transcript 摘要（用户输入 + agent 关键动作）
   - 本次涉及的 skill（experts 走到哪些 / _internal 调了哪些）
   - 当前这些 skill 的 frontmatter（keywords / chain / calls）
3. 你（agent）基于以上数据分析 3 个信号：
   - **keywords miss**：用户输入 vs 当前 keywords，找未命中的高频词
   - **重复模式**：transcript 中重复 ≥3 次的步骤，是否在 expert body？
   - **calls 漏调**：实际用到的 _internal 是否在当前 calls 字段？
4. 每条信号输出一段 unified diff（path + 改动）
5. 逐条问用户：`apply / skip / all-skip`
6. apply 写回 `~/skills-repo/<path>`，提醒 `skillctl lint && push`

## 反模式
- 改动幅度过大（>20 行）→ 先 dump 建议给用户人工 review，不自动 apply
- 同一段 keywords 短期内反复改 → 收敛性不足，停止建议
