---
name: 双上下文 XSS（escapeHtml 属性 + 内联 JS 解码）
date: 2026-04-17
type: antipattern
---

服务端 / 模板在 HTML 属性里做了 escapeHtml，但把同一个值也嵌入到 `onclick="..."` 的 JS 字符串里，浏览器会在 JS 进入属性前先解码 HTML 实体，于是 `&#39;` 变回 `'`，单引号闭合后注入 JS 生效。

**示例（踩坑）：**
```js
// admin/app.js 实际出现过
`<button onclick="revoke('${escapeHtml(title)}', ${amount})">撤销</button>`
// 当 title 是 `' ); alert(1); //` 时：
// escapeHtml 属性里看起来安全 `&#39; ); alert(1); //`
// 浏览器解码进入 JS 上下文后：`'); alert(1); //`  → XSS
```

**Why:**
HTML 属性解析 → JavaScript 解析 是两阶段；只在 HTML 层转义对 JS 层无效。任何把用户数据放进 `onclick=` / `href="javascript:"` / `<script>` 内联的场景都会遇到。

**How to apply:**
- 方案 A（推荐）：事件绑定用 `addEventListener`，完全避免内联 JS 字符串拼接
- 方案 B：确实要内联，用 `encodeURIComponent(value)` 传到调用端 decode，保证在 JS 字符串上下文里 100% 安全
- 方案 C：把数据放 `data-*` 属性，handler 里从 `event.target.dataset` 读

审查扫描：`grep -nE 'onclick=".*\$\{.*\}"' public/` 快速定位所有混上下文模板拼接。
