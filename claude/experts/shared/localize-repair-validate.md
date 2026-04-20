---
name: Agentless 三段式修 bug 模板（localize → repair → validate）
date: 2026-04-18
type: pattern
---

修 bug 默认走三段串行，不要让 LLM 自由 loop。

**Why:**
- OpenAutoCoder/Agentless 用这个方法在 SWE-bench 上干过一堆 agent 方案，$0.34/issue，便宜一个量级
- Agent 自由 loop 的常见失败模式：跑偏去探索无关文件、反复读同一段代码、在没定位清楚时就开改
- 三段式强制"先精确定位、再多候选修、再回归验证"，把 LLM 的自由度锁在确定性流水线里
- 2026-04 SWE-bench Verified 79.2% 属于工业级 scaffold；日常任务 Agentless 已够用

**How to apply:**
1. **Localize 分层定位**
   - repo → file：grep 错误信息 / stack trace 关键字
   - file → function：读上下文锁 function
   - function → lines：锁 3-10 行
   - 定不到 10 行以内**不进入下一段**，继续读
2. **Repair 多候选**
   - 生成 2-3 个差异化 diff：最小改动 / 防御式 / 小重构
   - 每个注明权衡（副作用、向后兼容、测试成本）
3. **Validate 双测**
   - **复现测试**：能重现 bug 的最小输入（没有就先补一个）
   - **回归测试**：现有测试套件
   - 两项都通过的候选里选最小改动

**提醒**：SWE-Bench Pro（真实代码难度）最好成绩 46%，自信度需打折；定位拿不准时宁可多读一轮也别直接开改。

适用：所有"修 bug"类任务。
不适用：纯新功能开发（无 bug 可 localize）、架构级重构。
