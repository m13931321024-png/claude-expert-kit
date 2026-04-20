---
name: default-value-backfill-trap
description: 参数默认值回填后，用"参数是否传入"做开关会永远为假
type: feedback
---

# 默认值回填陷阱 — 用"参数是否传入"做条件永远为假

## 规则

当一个函数的参数在**上游调用方已用同样默认值回填**之后，下游不要再用 `param ? A : B` / `if (param)` 这种"是否传入"的判断做开关 — 因为参数恒为 truthy，条件永远走同一分支。

**Why**：example-form-project preset 映射时踩过。`createNodeFromField(field, role?)` 内部写了 `...(role ? {} : preset.props)`，语义是"调用方没指定 role 时才套用默认 props"。但上游 drag-drop 总是传 `dragData.role`，而 `dragData.role` 本身就来自 `getDefaultPresetForField(field).role` 的回填 — 结果 role 永远 truthy，preset.props 永远不生效。修正为 `actualRole === preset.role` 才对。

**How to apply**：
- 写条件判断前反向追一层调用方，确认参数实际能否为 undefined。
- 可选参数有默认值时，判断"值是否等于默认"比"是否传入"更鲁棒。
- 更深层的问题：**把"调用方意图"（有没有手动指定）和"参数值"混用**。想表达意图就加布尔标志（`overrideRole: boolean`），别用参数存在性当代理。
- 特别警惕多跳链路：A 回填默认 → 传给 B → B 再判 "param 是否传入" — 这种模式几乎都是 bug。
