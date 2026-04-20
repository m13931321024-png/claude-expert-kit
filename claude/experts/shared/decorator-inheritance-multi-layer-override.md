---
name: 装饰器元数据继承在多层 skin 覆盖下的阻断陷阱
date: 2026-04-20
type: antipattern
---

当一个项目同时用到"装饰器类级元数据 + 类继承 + 多 skin 覆盖"这三件套时，元数据是否被继承到子类极易静默丢失。**没有编译错误**，只在 UI 里发现某个属性/能力缺失。

**典型场景**：
- headless 基类（HeadlessFoo）上声明 `@SetterProps` / `@FormWidget` / 其他类级装饰器
- 子类（NgZorroFoo extends HeadlessFoo）没重写装饰器 → 走原型链继承，拿到父类元数据
- 另一个子类（XpaFoo extends HeadlessFoo）自己**再**声明 `@SetterProps(...)` → **阻断**继承，父类装饰器里的 key 全丢
- 叠加项目自定义的"不继承 design skin"标记（如 `inheritDesignProps: false`）→ 两头都断

**Why**：装饰器元数据通常存在 `WeakMap<constructor, meta>`；`getMetadata(cls)` 的实现里"自己有就返回自己，没有再走 `Object.getPrototypeOf` 找父类"—— 子类**有**的时候直接返回，不会 merge。"继承"是 fallback 不是 merge。

**How to apply**：
- 跨层 skin 架构里，凡是新增 setter / capability / config 放 headless 基类上时，**同时 grep 所有继承链子类的 `@SetterProps`**（`grep -rn "@SetterProps\|@FormWidget" subclass-dir/`）
- 子类**自声明**的装饰器必须 `...SPREAD` 父类的键，或显式同步新 key
- 项目里的"完全不继承"标记（如 `inheritDesignProps: false`）是信号：这个 skin 已经从继承链脱离，所有新 key 必须手动同步
- 审查时看到"某组件继承自 X 但又自己声明 @Decorator" → 必定在某一天会漏同步，加单测守（或代码注释 `// 注意：保持与父类 SetterProps 同步`）
- Localize 修"UI 某 setter 不显示"类 bug 时，**不要只看当前 skin 的 @SetterProps**，必须遍历：headless → 当前框架 skin → metadataMerge 里的过滤标记（inheritDesignProps 等）

**验证信号**：写完后要确认 4 条路径的元数据合并结果：
1. 父类 @SetterProps → 子类 `getPropMetadata`（原型链继承）
2. design skin + runtime skin 的 metadataMerge 结果
3. 多个 runtime 框架（ng-zorro / xpa / devextreme）各自的独立路径
4. `inheritDesignProps: false` 影响的 skin
