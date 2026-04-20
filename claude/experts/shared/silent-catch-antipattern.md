---
name: 静默吞错的 .catch(() => {}) 反模式
date: 2026-04-17
type: antipattern
---

前端异步调用链里 `.catch(() => {})` / `.catch(() => undefined)` 会吞掉网络错、接口 5xx、解析异常等所有问题，线上排障时拿不到任何线索。

**Why:**
- 对开发者：错误被吃掉后 UI 会停留在 loading/空列表状态，用户看不到 toast，开发者看不到栈
- 对审查：这类写法经常伪装成"降级容错"，但降级应该 *承接一个本地分支*，而不是 *抛弃错误*
- 真实案例：flower 项目 AppStore 6 处对 API 调用用空 catch，导致优惠券/消息加载失败时用户看到空页面且无任何提示

**How to apply:**
审查 / 扫描步骤：
1. 全仓 `grep -n "\.catch(() => " src/`（或 ets/tsx）扫出所有候选
2. 逐个判断：
   - 确实有本地降级逻辑 → 最少加 `console.warn('[模块]', err)`
   - 没有降级 → 补 toast 或错误状态
   - 只想"不让 promise 传播"→ 用 `.catch(err => console.warn(err))`，别写空箭头
3. 代码写入阶段：统一 catch 带 logger，禁止空箭头 `.catch(() => {})` 形态（可加 ESLint 规则 no-empty / or custom）

对应 commit 形态：`fix(审查): 修复 N 处静默吞错`
