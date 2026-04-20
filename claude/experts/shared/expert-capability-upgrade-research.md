---
name: 用外部前沿项目反哺自己专家体系的调研方法论
date: 2026-04-18
type: pattern
---

当用户说"我想加强我的专家 skill / agent 能力"时，不要去搜"how to write better prompt"这类元话题，而是**搜真实世界最前沿的同类系统**，再按"能否写进我现有哪个专家/skill"反向分类。

**Why:**
- "怎么写好 prompt"类搜索会得到一堆抽象建议，落不到文件
- 真实前沿项目（Big Sleep / Agentless / OSS-Fuzz-Gen / Meta ACH 等）都是**完整工作流**，自带 localize/hypothesis/validate 这种可直接改写成 expert 指令段落的原语
- 按"技术领域"分类（fuzzing / static analysis / code review）会得到一份综述，对 skill 升级没用；按"能强化哪个现有专家"分类，每条都能直接变成 PR 到 `experts/{name}.md`

**How to apply:**

1. **把用户的 skill 体系先拉清单**（cwd=用户主目录时：`$HOME/.claude/commands/experts/` + `~/.claude/experts/shared/`）
2. **并行搜 4 条主线**（不是一条一条搜）：
   - 代表性开源 Agent 项目（SWE-agent / Agentless / OpenHands）
   - 大厂研究型系统（Big Sleep / Meta ACH / OSS-Fuzz-Gen）
   - 2025+ 学术论文（arXiv / benchmark 论文）
   - 商业工具经验数据（FP 率、SWE-bench 分数等用来约束专家自我认知）
3. **输出强制结构**：每条方案 → 对应能强化哪个专家 → 能落地成什么文字（段落级，不是概念级）→ 优先级 P0/P1/P2
4. **附带约束数据**：拿 benchmark vs 真实代码的差距（SWE-bench 70% vs SWE-Bench Pro 17%）、FP 率（早期 9:1 vs 现代 <5%）直接写进专家指令里，作为"不要过度自信"的硬提醒
5. **不抢跑改 expert 文件**：调研结束给清单 + 推荐，由用户选落地范围（A/B/C/D 式岔路，不用 yes/no）

**坑：cwd = 用户主目录的特殊情形**
- `{cwd}/.claude/experts/learnings/` 等同于 `~/.claude/experts/learnings/`，此时"项目本地经验"和"跨项目经验"路径冲突
- 处理：主目录场景下默认把经验都写到 `shared/`（因为用户主目录本身就是"跨项目"角色）；`learnings/` 只放 backlog 和一次性回流建议
