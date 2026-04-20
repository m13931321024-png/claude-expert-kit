---
name: 文档引用外部模板：只列必填字段指向单一真源，不要内嵌完整模板
date: 2026-04-20
type: antipattern
trigger: keyword:模板|template|文档|SOP|内嵌|duplicate
source: 2026-04-20 强化专家体系任务的审查阶段发现
---

当文档 A（如专家指令）需要引用文档 B（如通用模板）的结构时，**不要把 B 的完整内容内嵌进 A**。只保留"必填字段清单 + 指向 B 的链接"。否则 A 和 B 会漂移，读者不知该以谁为准。

**Why：**

本次"强化专家体系"任务里，`~/.claude/commands/experts/复盘.md` 的 Step 3.5 内嵌了一份 SOP 模板，和 `~/.claude/experts/shared/sop_template.md` 同时存在。两份各自演化必不同步 —— 审查阶段确实发现内嵌版少了 `source / 关联 SOP / 演进记录` 三段。如果读者只看 Step 3.5 的内嵌版，写出的 SOP 就会缺字段。

更本质：这是**软件工程里"单一真源（Single Source of Truth）"**原则在文档层的应用。内嵌 = 复制粘贴 = 双份维护成本 + 漂移必然。

**How to apply：**

- 文档 A 要复用 B 的结构时，用**表格列出 B 的关键字段**（哪些必填、哪些可选），然后一句话"完整结构见 `path/to/B.md`，直接复制改即可"
- 对 markdown 尤其注意：**三反引号嵌套会破坏渲染**。想在文档里展示另一个 markdown 的片段，要么用 `~~~` 外层，要么用表格描述结构
- 当 A 和 B 都由同一个人维护：仍遵守单一真源。"记得一起改" 在 3 个月后就不记得了
- 新增模板时，只在一个文件定义；其他所有"提及这个模板"的地方都用 link

**反例（本次犯过的）：**

```markdown
<!-- 复盘.md Step 3.5 旧版本 -->
**SOP 文件模板**：

​```markdown
---
sop: ...
prerequisites: [...]
---
# SOP: ...
## 何时用
...
## 输入
...
## 步骤
... （几十行完整模板）
​```
```

✗ 嵌套 ``` 冲突；✗ 和 `sop_template.md` 字段漂移

**正确（本次修复后）：**

```markdown
**SOP 文件结构（完整版见 `~/.claude/experts/shared/sop_template.md`）**：

| 段 | 必填 | 说明 |
|---|---|---|
| frontmatter: `sop` | ✓ | 任务类型标识 |
| ... |

**直接复制 `sop_template.md` 改即可，不要重造模板。**
```

✓ 无 markdown 冲突；✓ 字段变化只需改 `sop_template.md` 一处；✓ 读者明确知道去哪看完整版

**触发场景关键词**：写专家指令 md / 写 SOP / 写约定文档 / 在一个文件里"顺便展示" 另一个文件的结构。
