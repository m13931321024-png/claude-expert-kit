---
name: Agent 系统的分层记忆 + SOP 蒸馏 + Token 预算三轴
date: 2026-04-20
type: pattern
source: 2026-04-20 学习 GenericAgent / linux.do 帖的调研沉淀
---

设计多专家 / 多 Agent 系统时，除"角色分工 + 工具集"外，**分层记忆、SOP 蒸馏、Token 预算**是三根独立但互相强化的轴。缺任一根，系统都会在 50+ 轮规模内崩溃（上下文爆炸 / 经验不复用 / 成本失控）。

**Why（每根轴独立成立）：**

1. **分层记忆（L0-L4）**：平铺式 memory（所有条目每轮全量注入）在记忆条目 >10 时就让每轮 prompt 膨胀几 K token，且无关记忆稀释当前任务注意力。分层让"每轮必读的索引"只占几百字，详细内容按需 Read。
   - L0 元规则（10 行硬约束，必读）
   - L1 索引（每条记忆的一行 hook，必读）
   - L2 项目事实（按项目/按任务条件加载）
   - L3 可执行 SOP（关键字触发时 Read）
   - L4 历史会话归档（仅搜索时访问）

2. **SOP 蒸馏**：复盘输出"自然语言 learnings"时，下次复用靠模型自己回忆 → 高失败率。输出"可执行 SOP markdown"（含输入签名 / 步骤 / 验收标准 / 可复制脚本片段），下次 Read 就跑，失败率降一个数量级。
   - 判据：一条 learnings 如果不能被三个月后的新人照做，它就不是 SOP，只是故事。

3. **Token 预算**：Agent 系统容易"无限回合"。每轮必须有预算感知 —— 超阈值降级（压缩 / 切 subagent / 退出循环）。对比数据：同一个 "Hello" prompt，GenericAgent 2298 tokens / Claude Code 22821 / OpenClaw 43321。差 10× 不是模型问题，是系统设计。

**How to apply：**

| 三根轴 | 在 CC 专家体系的映射 |
|---|---|
| L0 元规则 | `CLAUDE.md`（已有，保持精简）|
| L1 索引 | `MEMORY.md` 当前是索引 but 每条 hook 可以更短 |
| L2 项目事实 | 每个 feedback/user/project `.md` 本体 |
| L3 SOP | 新建 `shared/sop_*.md` 或 `learnings/sop_*.md`（待落地） |
| L4 归档 | `~/.claude/projects/*/` transcript（CC 自带） |
| SOP 蒸馏 | 改 `experts/复盘.md` 加 `crystallize_to_sop` 动作 |
| Token 预算 | 扩展 `~/.claude/hooks/context-monitor/` 从阈值检测 → 记账 |

**反模式（别做）：**
- 把 L0-L4 全合在一个巨型 `context.md`：又回到平铺
- 每条 learnings 都单独建文件：shared/ 会碎片化，检索成本超过收益；同一主题合并
- 用自然语言复盘当 SOP：下次用不上就等于没写

**触发关键词**：设计 Agent 框架 / memory 层级 / 复盘机制 / token 膨胀 / 上下文预算 / multi-agent 协作成本。
