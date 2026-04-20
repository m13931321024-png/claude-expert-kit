---
name: 并行 WebSearch 粗筛 + 并行 WebFetch 细挖的两段调研法
date: 2026-04-18
type: pattern
---

做"领域内找优秀项目/工具/论文"类调研任务时，单轮串行搜索会漏掉关键项目且浪费轮次。用两段式并行组合拳：

**Step 1 — 4 个并行 WebSearch 粗筛不同切片**
一次 tool call 里发 4 条语义互补（不是同义改写）的查询，每条覆盖领域的一个不同维度。例如"找 bug 方向"拆成：
- awesome list / 清单入口
- 细分技术 A（e.g. fuzzing）
- 细分技术 B（e.g. mutation testing）
- benchmark / leaderboard（定位 SOTA）

**Step 2 — 4 个并行 WebFetch 细挖目标项目**
粗筛摘要里通常缺 star 数、架构细节、可借鉴点；对 3-4 个最有希望的项目同时 WebFetch 原 README，问题要具体（"列出架构/workflow/支持语言/star 数"），别让它自由总结。

**Why:**
- 并行比串行省 3-4 轮等待；粗筛切片互补比"改关键词再搜一次"覆盖面大得多
- WebSearch 摘要是搜索引擎描述 + 模型二次概括，几乎永远缺 star 数、cost 数字、具体算法名；**必须用 WebFetch 去原始页面确认才能给出带数字的清单**
- 本次调研实证：首轮 4 并行 WebSearch 发现 20+ 项目但只有 2 个带 star 数，第二轮 4 并行 WebFetch 补齐了 Agentless（2k）、RepoAudit（373）、mutahunter（295）等关键数据
- 单独问"github xxx stars"这种查询往往拿回营销博客、综述文章，反而拿不到真实数字；直接 fetch 项目首页更准

**How to apply:**
1. 任务拆成 3-5 个互补切片（不是改同义词）→ 一条消息 4 个 WebSearch 并行
2. 从粗筛结果里选 3-4 个值得深挖的项目 → 一条消息 4 个 WebFetch 并行，prompt 里明确要数字（star/cost/性能）
3. 如果第二轮仍缺关键数据，可追加一轮针对性 WebFetch，但不要退化成串行单搜
4. 最终清单按"可借鉴点"而非"star 数"排序，star 只是辅助筛选；P0/P1/P2 分层便于下游专家取用

适用场景：技术选型、工具生态盘点、论文/项目综述。不适用：已知具体 URL（直接 WebFetch）、或需要官方最新 API 文档（优先看 docs 站而非搜索）。
