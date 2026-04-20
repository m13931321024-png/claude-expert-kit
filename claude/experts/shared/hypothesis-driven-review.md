---
name: 假设驱动代码审查（Big Sleep / RepoAudit 范式）
date: 2026-04-18
type: pattern
---

审查安全关键代码或历史高 bug 模块时，别"从上往下读一遍"——按假设驱动走。

**Why:**
- 全量阅读 LLM 会无差别报一堆低信号 finding（"可能"、"建议考虑"），用户精力被稀释
- Google Big Sleep 用这个范式在真实代码里发现 CVE-2025-6965 等 0-day：先 threat model，再产生可测试的假设，逼自己给 PoC
- RepoAudit（ICML 2025）三个月在开源项目找到 100+ bug，同样是 MetaScan 语法 + DFBScan 数据流的假设驱动
- 没有 PoC 的 finding 是噪音——它可能对也可能错，但无法让对方采取行动

**How to apply:**
1. 建 **threat model**（2-3 行就够）：
   - 输入从哪来？（用户 / 文件 / 网络 / DB / 环境变量）
   - 输出到哪？（DOM / SQL / shell / 文件 / 日志）
   - 信任边界在哪？谁跨谁？
2. 列 3-5 个具体假设，形式 `如果 [条件] 成立，就会 [后果]`
   - 例：如果 `req.body.name` 未校验长度，拼 SQL 前又未 escape → SQLi
3. 每条假设写出 **最小 PoC**：具体输入值 / curl 命令 / 单测代码；写不出 PoC 的假设直接砍
4. 最终 finding 格式：`[假设] → [PoC] → [预期失败表现] → [修复建议]`

适用：安全审计、reproducer-first 审查、对高价值模块的定期 red team。
不适用：日常 PR review（成本过高），用标准三层审查就够。
