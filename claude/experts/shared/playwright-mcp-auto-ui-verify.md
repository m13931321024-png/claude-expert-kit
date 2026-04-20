---
name: 用 @playwright/mcp 做交付后自动 UI 验证
date: 2026-04-20
type: pattern
source: 2026-04-20 调研 Playwright + MCP 用于前端项目自动 QA
---

在专家链 `交付 → 复盘` 之间插入一个"UI 验证"子阶段：用 `@playwright/mcp` 让 Agent 通过 **a11y tree**（非截图/像素）操纵真实浏览器，验证本次改动未引入 UI 回归。失败 trace 作为 artifact 回流给开发专家。

**Why：**
- 交付阶段目前只看"编译通过 + 单测通过"，漏掉"UI 能点 / 数据正确流转"类回归 — 而这类回归对前端项目是最致命的
- Playwright 的 a11y tree 输入对 LLM **确定性强、token 省**，不需要视觉模型（vs 截屏 + vision 模型每次千 token 起）
- Trace Viewer 的三层时间线（action + DOM snapshot + 网络）≈ 复盘素材天然结构，可直接喂给开发/审查专家定位
- @playwright/mcp 是 Microsoft 一等公民项目，不是社区 hack，稳定性有保障

**How to apply：**

1. **安装 MCP（一次性，全局）：**
   ```bash
   claude mcp add playwright npx @playwright/mcp@latest
   ```
   CC 重启后生效，Agent 可调用的工具 +50（click/type/navigate/snapshot/evaluate/route/storage/tab/...）

2. **交付后自动 QA 流程（融入专家链）：**
   - 交付专家推送 commit 后，启动一个 `ui-verify` subagent
   - subagent 用 playwright-mcp 工具：
     - `playwright_navigate` 打开 dev server
     - 按预定义用例（每个 core flow）`playwright_snapshot` 关键节点 a11y tree
     - 对比 baseline（首次运行时建立）
   - 差异命中 → 生成失败 trace → 回流给开发专家修复 → 不命中 → 进入复盘

3. **Baseline 管理：**
   - baseline 存 `{cwd}/.claude/experts/ui-baseline/<flow>.json`
   - 首次建立需用户确认是"符合预期的状态"
   - 每次升级 baseline 要在 handoff/learnings 里明记"为什么接受这次改变"

4. **适用项目类型：**
   - ✅ 前端项目（Angular / React / Vue / static）
   - ✅ 包含用户交互流程的（表单 / 仪表盘 / 编辑器）
   - ⚠️ 纯后端 / CLI 工具：没必要
   - ⚠️ 纯设计稿阶段：用 Pencil / Figma MCP，不用 Playwright

5. **和 `@playwright/test` 的分工：**
   - `@playwright/test`：开发者/CI 手写的**稳定长期**测试（PR 阻塞）
   - `@playwright/mcp`：Agent 临时驱动的**探索式**验证（交付时发现回归）
   - 两者可共存：mcp 发现的回归写成 `@playwright/test` 案例固化下来

**反模式：**
- 用 playwright-mcp 跑完整 E2E 回归套件：浪费，它适合"关键几个 flow 的快速检查"，完整 E2E 用 `@playwright/test` + CI
- 每次都从 baseline 重建：让回归失去意义，baseline 要稳定
- 用截屏比对（toHaveScreenshot）代替 a11y tree：成本高且对字体/浏览器渲染敏感，推荐只在"视觉回归是核心需求"时用

**触发关键词**：前端项目交付验证 / UI 自动测试 / 回归测试自动化 / Agent 浏览器操纵 / Playwright / 自动 QA / 截图对比。
