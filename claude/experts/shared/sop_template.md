---
sop: <task_type_kebab_case>
date: YYYY-MM-DD
trigger: keyword:|stage:|project:   # 何时提醒本 SOP
prerequisites: [列出前置条件]
source: <本 SOP 从哪次任务蒸馏>
---

# SOP: <任务类型一句话>

> **模板说明**：这是 SOP 文件模板。复盘专家蒸馏 SOP 时参照此格式。
> 保留此模板文件，**不要删除**。实际 SOP 文件命名为 `sop_<task_type>.md`（和本文件不同名）。

## 何时用

一句话说明什么任务适用此 SOP。读者一眼判断"是我要的吗"。

示例：
- "新增一个 example-form-project 后端接口，前端要接入"
- "修一个 Angular signal effect 循环依赖的 bug"
- "把一个 CC 专家文件的指令做增量升级"

## 输入（必须具备的信息）

读者开始前要先确认：

- [ ] 输入 1（例：接口的 swagger URL）
- [ ] 输入 2（例：要接入的页面组件路径）
- [ ] 输入 3（例：已登录的测试账号）

缺任一 → 先补齐再开始。

## 步骤

### Step 1: <动作名>

**目的**：这一步要达成什么。

**操作**：
```bash
# 可直接复制粘贴的命令
cd /path/to/project
npx something --flag
```

**验收**：
- [ ] 文件 X 存在
- [ ] 命令退出码为 0
- [ ] 输出包含 "success"

### Step 2: <动作名>

（同上结构）

### Step 3: <动作名>

（同上结构）

## 整体验收标准

所有步骤完成后，最终交付物应满足：

- [ ] 标准 1（例：编译通过）
- [ ] 标准 2（例：浏览器访问新接口能拿到数据）
- [ ] 标准 3（例：测试用例全绿）

## 失败回滚

如果某步中途失败，按此顺序撤销：

1. `git reset --hard HEAD~1`（撤回未推送的 commit）
2. `rm <创建的文件>`
3. 回到步骤 N 重试

## 可复用片段（Copy-Paste 区）

下面是可直接复制到其他任务的片段：

```bash
# 片段 1：xxx
...
```

```typescript
// 片段 2：xxx
...
```

## 关联 SOP

- 上游：（如果本 SOP 开始前要跑别的 SOP）
- 下游：（本 SOP 完成后自然进入哪个 SOP）
- 替代：（如果条件不同可以换哪个 SOP）

## 演进记录

- YYYY-MM-DD 初版，从任务 <X> 蒸馏
- YYYY-MM-DD 增加 Step N（原因：发现 <Y>）
