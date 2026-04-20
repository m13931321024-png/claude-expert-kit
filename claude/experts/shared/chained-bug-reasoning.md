---
name: 链式 bug 推理 — 组合绕过才是真 finding
date: 2026-04-18
type: pattern
source: Claude Mythos Preview red.anthropic.com 2026-04
---

真正高危的 bug 很少是单点 —— 多数是 **两个独立看起来都安全的机制互相冲突 / 绕过**。Mythos Preview 发现的 27 年 OpenBSD SACK 漏洞、FreeBSD NFS RCE（ROP 链超 1000 字节、分 6 次 RPC）、浏览器 JIT 4 漏洞链 —— 全是这种模式。单看每个检查、每个函数都没问题，组合起来才炸。

**Why：**
- LLM 审查最容易漏的就是这种，因为阅读流水线是"一段一段看"，组合视角需要显式强制
- 单点 bug 多数已被历史 lint / code review 扫干净；现代代码库剩下的 bug 密度最高的正是组合类
- 链式推理正是小模型和 Agentless 类工作流对标 Mythos 的唯一可行路径——不拼模型规模，拼 prompt 结构

**How to apply（审查时强制检查）：**

1. **找"两道独立安全措施"的交界点**：
   - 边界检查 A 用的是 `int32`，下游消费 B 用的是 `uint16` → 整数转换差
   - 函数 X 认为输入已清洗，函数 Y 调用时绕过了清洗入口
   - 权限检查在 route 层，但内部调用链绕过 route 直达 service 层

2. **问"如果 [条件 A] 成立 + [条件 B] 也成立，会不会解锁新状态"**：
   - 单独 A 或单独 B 都触发不了；两者同时成立时系统进入未预期状态
   - 典型：TOCTOU（检查和使用之间状态变化）、并发竞态、缓存/源不一致

3. **检查"不可达路径"是否真不可达**：
   - 整数溢出链可以让"理论不可达"的分支可达（Mythos OpenBSD SACK 案例）
   - 异常/panic 恢复路径经常绕过主路径的守卫

4. **定型的组合陷阱清单**：
   - escapeHtml 属性层 + 属性值进 JS 上下文（双上下文 XSS，见 `dual-context-xss.md`）
   - 同一 key 两个 TTL 不一致的缓存（过期差触发脏读）
   - 前端反序列化放宽 + 后端序列化严格（伪造字段通过）
   - rate limit 按 userId + API 按 tokenId（同人多 token 绕过）

**不适用场景：**
小工具脚本、一次性迁移代码、纯算法题 —— 没有独立信任边界不形成链。
