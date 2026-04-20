---
name: Mutation 倒推测试强度（不看 coverage 看 mutation score）
date: 2026-04-18
type: pattern
---

判断测试是否真的有效，别看覆盖率——看 mutation kill 率。

**Why:**
- 覆盖率 90% 不代表测试强：测试可能只验证"函数跑完不抛"，不验证行为正确性
- Meta ACH（2025）用 LLM 生成 mutant 倒推测试缺口，已在生产使用
- mutahunter / LLMorpheus 都证明：同样的代码，改个运算符、翻个条件、删一行——测试如果还全绿，它没在真正断言行为
- 比"再加几个测试"更有方向：哪个 mutant 没被 kill，就缺哪个测试

**How to apply:**
1. 挑关键模块（核心算法、支付、权限、数据转换）
2. 引入 5-10 个小 mutant：
   - 改运算符：`>` → `>=`、`&&` → `||`
   - 翻转条件：`if (x)` → `if (!x)`
   - 删一行（边界检查 / 空值处理）
   - 改常量：`0` → `-1`、`[]` → `[undefined]`
3. 跑测试统计 killed / survived
4. 对 survived 的 mutant，写对应 assertion 补测（而不是泛泛"再加几个测试"）
5. 解析 / IO / 边界场景配合 fuzz 风格输入：空串 / 超长 / 非法 UTF-8 / 深度嵌套 / 负数 / 0 / NaN

**目标**：关键模块 **mutation score > 80%**，而不是 coverage > 80%。

适用：核心模块的测试质量评估、回归测试强度审计、"测试都绿但线上还是出 bug"的诊断。
不适用：UI/样式代码（mutation 难定义）、胶水代码（ROI 太低）。
