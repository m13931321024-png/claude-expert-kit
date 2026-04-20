---
name: 从闭源前沿模型公开披露反哺开源工作流
date: 2026-04-18
type: pattern
source: 2026-04-18 把 Claude Mythos Preview 能力融入专家 skill 的实战
---

前沿模型（Mythos Preview / Big Sleep / Project Naptime 等）**权重闭源**但**能力不秘密**。要把它们的能力迁移到自己的工作流，不需要 API 访问或权重——读它们的 red team blog、system card、第三方评估报告就够了。

**Why：**
- 闭源厂商出于竞品压力必须披露能力数据（SWE-bench / CTF / TLO 分数），这反过来要求他们披露**具体工作流**，否则数据没人信
- 第三方机构（AISI、学术 benchmark 作者）的评估会强制暴露"用了什么脚手架、失败在哪"，信息密度比厂商官方 blog 更高
- 前沿模型的"能力"80% 是**工作流结构**（假设驱动、文件预评分、多 agent 分工、外部 oracle），20% 才是模型本身；前者可以直接复制

**How to apply（每次前沿模型公告发布后）：**

1. **三源并采**：
   - 厂商官方 technical deep-dive（red.anthropic.com / openai.com/research / deepmind blog）—— 有工作流描述
   - 第三方评估（AISI / METR / Apollo Research）—— 有失败模式和边界
   - 记者拿到的 ≠ 官方 blog 的角度（TechCrunch / Bloomberg / The Information）—— 有应用场景

2. **WebFetch 原文而不是 WebSearch 摘要**：摘要会丢掉具体数字、具体工作流步骤、成本数据。读 blog 原文。

3. **按能力维度切片**，每条问三个问题：
   - **具体工作流是什么**（能写成 5-10 行 checklist 的那种）
   - **成功指标是什么**（什么情况下算这条能力生效了）
   - **能迁移到我现有哪个 skill**（审查/开发/复盘？还是新 skill？）

4. **跳过不适用的能力**：
   - 依赖专用硬件 / sanitizer / fuzzer 的 → 除非项目已经有对应工具，否则不迁移
   - 依赖 100M+ token 推理预算的 → 日常场景不切，不迁移
   - 依赖厂商专属数据的（threat intel feed、私有 CVE 库）→ 不迁移

5. **标注出处**：每个迁移过来的段都标明 `（X 范式，源自 Y blog）`，下次能力升级时方便回溯。

**反模式：**
- 看到 benchmark 分数就去改 skill——**不要**，分数是结果不是方法
- 只读官方 blog，不看第三方评估——**会漏失败模式**，工作流写出来会过于乐观
- 逐条硬搬不做取舍——**会把 skill 文件撑大到不可用**。10 条能力保守选 6-8 条落地

**成本参考：**
本方法一次完整采+拆+落地 < 15 分钟 / 3 次 WebFetch + 5 次 Edit。比自己从零设计 skill 便宜一个数量级。
