# 路由设计 — UserPromptSubmit Hook

## 解决的问题

agent 不会主动调 `experts:*` skill。靠 description 注入 system prompt 的"自觉调用"调用率约 40-60%。

## 解法：UserPromptSubmit hook 强制路由

### 算法

1. 用户输入抵达 hook（stdin）
2. hook 读 `~/.claude/hooks/expert-router/router.json`（由 `skillctl sync` 生成）
3. 关键词扫描：用户输入命中任一 expert 的 `keywords` 列表
4. 命中 → stdout 注入 `必须先调 Skill: experts:<name>`，agent 看到强制路由
5. 同时注入该 expert 的 `chain` 提示，方便链式自动流转

### 与 v0.1 的差异

| 维度 | v0.1 (router.sh) | v0.2 (router-v2.sh) |
|---|---|---|
| 路由表数据源 | hook 脚本里**写死** | 读 `router.json`（sync 生成）|
| 新增 expert | 改 hook 脚本 | `skillctl sync` 自动生效 |
| 关键词命中后行为 | 仅注入"路由判断"通用文档 | 注入**具体哪个 expert 必须调** |
| chain 信息 | 静态映射 | 从 router.json 动态读 |
| Token 占用 | 固定（路由表全注入）| 仅命中时多注入一段（更省）|

### 升级路径（保留 v0.1 fallback）

```bash
# 备份 v0.1
mv ~/.claude/hooks/expert-router/router.sh \
   ~/.claude/hooks/expert-router/router.sh.v0.1.bak

# 启用 v0.2
cp examples/hooks/router-v2.sh ~/.claude/hooks/expert-router/router.sh
chmod +x ~/.claude/hooks/expert-router/router.sh

# 生成 router.json（如未生成）
skillctl sync
```

### v0.2 兼容性保证

`router-v2.sh` 在 `router.json` 不存在时自动退化为静态头，不会让你的 CC 启动失败。

## 强制路由是否会"误判"

会。误判风险来自：
- keywords 词过于通用（如 `"修"` 命中 `"修改文档措辞"` 这类非 bug 任务）
- 多 expert keywords 重叠（hook 取**第一个命中**，可能不是最合适的）

**缓解**：
1. keywords 列表越具体越好（`修bug` 优于 `修`）
2. 优先级（priority）= high 的 expert 排在前面
3. 用户明确不需要专家时输入"闲聊：xxx"绕开（hook 检测到`闲聊：` 前缀跳过）— V3 加

## 调用率监控（V2 后续）

`skillctl status` 可统计：
- 最近 100 个 user prompt 中命中 trigger 的比例
- 每个 expert 的实际调用次数
- 路由覆盖率 = 命中 expert 数 / 应当走 expert 的任务数（人工标注 baseline）

目标：调用率 ≥ 80%。
