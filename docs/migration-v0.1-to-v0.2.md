# 从 v0.1 升级到 v0.2

## 核心变化

| 维度 | v0.1 | v0.2 |
|---|---|---|
| skill 来源 | 仓库 `claude/commands/experts/` 直接拷贝 | 自己的 Git skills repo（canonical 格式）|
| 跨设备同步 | 手动 git clone 仓库 | `skillctl pull` 一键 |
| 跨平台格式 | 仅 CC | canonical → adapter（V2 起 Codex）|
| expert 调底层 skill | 文字提及 | `calls` 字段 + SlashCommand 嵌套 |
| 路由 hook | 路由表写死 | 读 router.json 动态生成 |

## 升级步骤（v0.1 → v0.2，零数据丢失）

### 1. 装新依赖

```bash
brew install yq jq bats-core
```

### 2. 初始化你的 skills repo

```bash
skillctl init --repo git@github.com:你的用户名/skills-repo.git
# 或不指定 repo URL，先本地用：
skillctl init
```

会创建 `~/skills-repo/{experts,_internal,_tools,.skillctl}/`。

### 3. 迁移 v0.1 的 expert 定义

```bash
skillctl migrate --dry-run    # 先看清单
skillctl migrate              # 实际执行
```

迁移规则：
- 扫 `~/.claude/commands/experts/*.md`
- 补缺字段：`type=expert / version=0.2.0 / platforms=[claude-code] / chain=[] / calls=[] / keywords=[]`
- 写到 `~/skills-repo/experts/<name>.md`
- **v0.1 文件不删，可随时回滚**

### 4. 校验 + 渲染

```bash
skillctl lint                 # 期望: lint passed
skillctl sync                 # 渲染产物到 ~/.claude/{commands,skills,hooks}
```

`skillctl sync` 输出三类产物（每个 expert 三份）：
- `~/.claude/commands/experts/<slug>.md` — SlashCommand 形态（v0.1 兼容）
- `~/.claude/skills/experts/<slug>/SKILL.md` — Skill 形态（**v0.2 新增**，提高调用率）
- `~/.claude/hooks/expert-router/router.json` — 路由表数据

### 5.（可选）切换 v0.2 hook

v0.1 router.sh 仍工作；切到 v0.2 才能享受动态路由表 + 强制路由：

```bash
mv ~/.claude/hooks/expert-router/router.sh \
   ~/.claude/hooks/expert-router/router.sh.v0.1.bak
cp /path/to/claude-expert-kit/examples/hooks/router-v2.sh \
   ~/.claude/hooks/expert-router/router.sh
chmod +x ~/.claude/hooks/expert-router/router.sh
```

### 6. 推送共享

```bash
skillctl push -m "init: migrate from v0.1"
```

第二台设备用：

```bash
git clone git@github.com:你/skills-repo.git ~/skills-repo
skillctl link --activate            # 软链激活
# 或：
skillctl sync                       # 复制激活
```

## 回滚到 v0.1

```bash
# 1. 还原 hook
mv ~/.claude/hooks/expert-router/router.sh.v0.1.bak \
   ~/.claude/hooks/expert-router/router.sh

# 2. 删 v0.2 渲染产物（v0.1 commands/experts/ 还在）
rm -rf ~/.claude/skills/experts ~/.claude/skills/_internal
rm ~/.claude/hooks/expert-router/router.json
```

`~/skills-repo/` 保留也无副作用（它是源文件目录，v0.1 不读它）。

## 不变的（保持兼容）

- `~/.claude/commands/experts/*.md` 的 SlashCommand 触发器（`/experts:开发`）
- `claude/hooks/context-monitor/` 上下文监控
- `claude/shared/` 跨项目经验
- `system/com.cc.claude-wrapper-self-heal.plist` LaunchAgent

## 已知 caveat

1. v0.1 文件如有自定义 frontmatter 字段（非标准），migrate 会保留但 lint 可能 warn `additionalProperties`
2. 如果你手动改过 `~/.claude/commands/experts/<name>.md` 的 body，先 commit 一次再 migrate（确保改动有版本备份）
3. canonical 文件名与 v0.1 一致（中文 expert 名直接复用），CC slug 路由不变
