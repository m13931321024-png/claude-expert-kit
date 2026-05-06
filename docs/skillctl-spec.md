# skillctl CLI 规范

主入口 `bin/skillctl`，dispatch 到 `cli/cmd/<name>.sh`。

## 全局选项

| flag | 作用 |
|---|---|
| `-h, --help` | 帮助 |
| `-V, --version` | 版本 |
| `-q, --quiet` | 抑制非错误输出 |
| `-v, --verbose` | 调试日志 |
| `--no-color` | 关闭颜色 |

## 全局退出码

| 码 | 含义 |
|---|---|
| 0 | 成功 |
| 1 | 用户错误（参数/已存在/校验失败） |
| 2 | 系统错误（IO/网络/外部命令） |

## 子命令

### `skillctl init [options]`

初始化私有 skills 仓库。

| flag | 默认 | 说明 |
|---|---|---|
| `--repo <url>` | - | git remote URL（可选） |
| `--dir <path>` | `$HOME/skills-repo` | 本地路径 |
| `--force` | false | 已存在时覆盖 |

动作：mkdir / git init / 写 `.skillctl/config` / 拷示例 skill / （可选）add remote。

### `skillctl sync [options]`

把 canonical skills 渲染到目标平台 + 生成 router.json。

| flag | 默认 | 说明 |
|---|---|---|
| `--dry-run` | false | 只打印不写 |
| `--target` | `claude-code` | `claude-code` / `codex`（V2） |

动作：先跑 lint → 渲染 SlashCommand + Skill 双形态 → 生成 router.json。

### `skillctl lint [PATH...]`

JSON Schema 校验 + 字段交叉验证。

不带参数 → 校验 `$SKILLS_REPO_DEFAULT` 下所有 `*.md`。

校验项：必填字段 / 枚举值 / name 格式 / chain & calls 引用存在性 / description 长度。

### `skillctl pull [--rebase]`

git fetch + merge/rebase + 自动 sync。

退出码：0 成功 / 1 冲突 / 2 sync 失败。

### `skillctl push [-m MSG] [--dry-run]`

git add + commit + push。

退出码：0 成功 / 1 nothing to commit 或无 remote / 2 push 失败。

### `skillctl link` _(P1)_

把 `~/skills-repo` 软链到 `~/.claude/skills`（替代 sync 的 copy 模式）。

### `skillctl chain show <expert>` _(P1)_

打印 expert chain DAG。

### `skillctl migrate [--from v0.1] [--dry-run]` _(P0 后续)_

幂等迁移：扫 `~/.claude/commands/experts/*.md` → 补缺字段 → 写 `~/skills-repo/experts/`。
v0.1 文件**不删**，可回滚。

## 错误信息格式

`<command>: <severity>: <file>:<line>: <message>`

样例：
```
[error] sync: lint failed: experts/开发.md: chain[0] 'experts:nonexistent' not found
[error] init: ~/skills-repo already exists. use --force to overwrite
[warn]  experts/开发.md: description 215 chars > 200; will be truncated on sync
```

## 依赖

- `git`（init/pull/push 需要）
- `yq`（lint/sync/migrate 需要）— `brew install yq`
- `jq`（lint/sync/migrate 需要）— `brew install jq`
- `bats-core`（仅运行 tests/）— `brew install bats-core`
