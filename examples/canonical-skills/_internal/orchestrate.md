---
name: _internal:orchestrate
type: internal
description: 多 Agent 协作 — 派发任务给子 agent 并行，收集结果，验收闭环
keywords: [多Agent, 并行, sub-agent]
version: 0.2.0
platforms: [claude-code]
maintainer: 加州
---

# orchestrate

任务可拆分且子任务无依赖时，派子 agent 并行干活。

## 步骤
1. 拆解任务为 N 个独立子任务
2. 每个子 agent 收到完整 brief：任务 + 涉及文件 + 期望输出 + 项目上下文
3. 一次发起多个 Agent 调用（同条消息内多个 tool_use）
4. 收集回执 → 主 agent 验收（diff / test / lint）
5. 任一子任务失败回收主流程降级处理

## 反模式
- 把强依赖任务并行化（B 依赖 A 输出，并行就乱）
- 把单步任务拆得过细（启动 sub-agent 开销 > 收益）
