# claude-expert-kit

> **Turn your Claude Code into a 6-expert closed-loop workflow** — with layered memory, SOP distillation, context-overflow hard-block, and one-line install/uninstall.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一键把默认 Claude Code 改造成**工程化 AI 工作流**：`调研 → 设计 → 开发 → 审查 → 交付 → 复盘` 六专家闭环 + 分层记忆 + SOP 蒸馏 + 上下文 40% 硬阻塞 + 权限免弹窗。

---

## Install

**一键安装**（推荐）：

```bash
curl -fsSL https://raw.githubusercontent.com/m13931321024-png/claude-expert-kit/main/install.sh | bash
```

自动做了 7 件事：
1. 检查依赖（git / bash / python3）
2. clone 到 `~/.claude-expert-kit/`
3. 备份已有 `~/.claude/` → `~/.claude.backup-{stamp}/`
4. 把 6 专家 / hooks / shared 经验 **symlink** 到 `~/.claude/`
5. 首次安装 seed `CLAUDE.md` 和 `settings.json`（已有则跳过）
6. 安装 wrapper（免权限弹窗）
7. 跑 doctor 体检

**卸载**：

```bash
curl -fsSL https://raw.githubusercontent.com/m13931321024-png/claude-expert-kit/main/uninstall.sh | bash
```

**本地已 clone 后**：

```bash
bash ~/.claude-expert-kit/install.sh     # 装
bash ~/.claude-expert-kit/uninstall.sh   # 拆
bash ~/.claude-expert-kit/doctor.sh      # 体检
```

> ⚠️ **Security Notice** — `curl | bash` 要求你信任上游仓库。如果你不熟悉作者：
> - 推荐先 clone 审阅脚本再跑（见 [Option: 本地 clone](#option-本地-clone-后装)）
> - 核对文件来自 `github.com/m13931321024-png/claude-expert-kit`，而不是被劫持的 URL
> - 不要用环境变量 `KIT_REPO=任意地址` 除非你审查过那个 repo
>
> **Fork 后自定义**：把上面 URL 里的 `m13931321024-png` 换成你的 GitHub username；README / install.sh / uninstall.sh 里的 URL 也要同步改（或使用 `KIT_REPO` 环境变量，见 [Option: 自定义 Fork](#option-自定义-fork--安装)）。

### Option: 预览模式（不真改）

```bash
curl -fsSL https://raw.githubusercontent.com/m13931321024-png/claude-expert-kit/main/install.sh | DRY_RUN=1 bash
```

### Option: 本地 clone 后装

```bash
git clone https://github.com/m13931321024-png/claude-expert-kit.git ~/.claude-expert-kit
bash ~/.claude-expert-kit/install.sh
```

### Option: 自定义 Fork + 安装

```bash
KIT_REPO="https://github.com/YOUR-USERNAME/claude-expert-kit.git" \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/YOUR-USERNAME/claude-expert-kit/main/install.sh)"
```

---

## Features

| 能力 | 解决什么痛点 |
|---|---|
| **6 专家闭环**（调研/设计/开发/审查/交付/复盘） | 同一需求响应随机、经验散落 |
| **Router Hook** 自动路由 | 不再问"要不要用专家"，识别意图直接启动 |
| **handoff.md 接力** | 专家间自动传递上下文，无需用户重述 |
| **分层记忆**（L0-L4 + trigger 字段）| 避免每轮 prompt 膨胀 |
| **SOP 蒸馏** | 复盘输出可执行 SOP，同类任务下次直接跑 |
| **上下文 40% 硬阻塞** | 超阈值自动 block + 暂存 + 续接，避免静默溢出 |
| **Wrapper 免弹窗**（bypassPermissions）| 改 10 个文件弹 10 次 → 零弹窗 |
| **LaunchAgent 自愈** | CC 升级覆盖 wrapper → 5 分钟内自动恢复 |
| **Playwright MCP** 自动 UI 验证 | Agent 用 a11y tree 操纵浏览器做回归 |
| **一键备份** | 每次大改前 10 秒 tar 备份 |

---

## Usage — 6 个专家怎么用

安装后**不需要显式调用专家**。用自然语言说需求，Router 自动匹配：

| 你说 | 自动启动的链路 |
|---|---|
| "帮我加一个页面" | 调研 → 设计 → 开发 → 审查 → 交付 → 复盘 |
| "修这个 bug" | 开发（Agentless 三段式：Localize → Repair → Validate） → 审查 → 交付 → 复盘 |
| "优化一下这段代码" | 调研 → 开发 → 审查 → 交付 → 复盘 |
| "提交到 feat 分支" | 交付 → 复盘 |
| "回顾一下今天做的" | 复盘 |
| "学一下 React Server Components" | 调研 → 复盘（不需开发）|

要打断路由：直接说 "跳过专家" 或 "直接回答"。

### 每次对话发生了什么

1. 你发消息 → `UserPromptSubmit` hook 触发（0-3 ms）
2. `router.sh` 读 `handoff.md` + `learnings/` + `shared/` → 注入路由规则到你的 prompt 前
3. `context-monitor.sh` 读当前会话 transcript → 算 token 用量 → 超 40% 就 block + 暂存
4. 模型看到 prompt + 注入 → 判断意图 → 加载对应专家 skill
5. 专家执行 → 写 `handoff.md` → 自动跳到下一个专家
6. 末尾复盘专家 → 沉淀 learnings 或 SOP → 清理 handoff

---

## Requirements

- **OS**: macOS / Linux（Windows 需 WSL）
- **Claude Code**: 任意最新版本
- **依赖**: `git` / `bash` / `python3`（hooks 需要）
- **推荐**: `gh` CLI（交付专家做 PR 要用）

---

## Customization

所有内容都是 markdown / shell，自由修改：

| 想改什么 | 改哪里 |
|---|---|
| 专家指令 | `~/.claude-expert-kit/claude/commands/experts/*.md` |
| 路由规则 | `~/.claude-expert-kit/claude/hooks/expert-router/router.sh` |
| 上下文阈值 | `~/.claude-expert-kit/claude/hooks/context-monitor/context-monitor.sh` 顶部的 `_THRESHOLD` |
| 视觉打扰规则 | 同上 router.sh 里的注入段落 |
| 备份 exclude 列表 | `~/.claude-expert-kit/claude/experts/shared/sop_backup-claude-config.md` |

改完 `git pull` 即生效（symlink 模式）。不想贡献回上游？fork 然后改 `KIT_REPO` 环境变量重新安装。

---

## Uninstall

```bash
bash ~/.claude-expert-kit/uninstall.sh
```

会：
- 移除所有 symlink（指向本 repo 的）
- 保留你自建的 memory / learnings / settings.local.json
- 提示是否恢复 `~/.claude.backup-*/` 备份
- 删除 `~/.claude-expert-kit/` 目录

**彻底还原到安装前**：
```bash
RESTORE_BACKUP=~/.claude.backup-{stamp} bash ~/.claude-expert-kit/uninstall.sh
```

---

## FAQ

**Q1: bypassPermissions 安全吗？**
wrapper 默认注入 `--permission-mode bypassPermissions` 跳过所有权限弹窗。你信任自己的 Agent 行为才开。不想开就：`SKIP_WRAPPER=1 bash install.sh`。

**Q2: 会影响已有的 `~/.claude/` 吗？**
首次安装时先备份到 `~/.claude.backup-{stamp}/`，然后 symlink 六专家/hooks 到 `~/.claude/`。你已有的 memory / settings.local.json / sessions 原地不动。

**Q3: 能跟其他 CC 扩展共存吗？**
能。本套只占 `commands/experts/`、`experts/shared/`、`hooks/expert-router/`、`hooks/context-monitor/` 几个固定位置，其他位置不碰。

**Q4: 没有 `~/.local/bin/claude` 怎么办？**
Wrapper 是可选增强。如果你的 claude CLI 在其他路径，改 `bin/claude-wrapper-install.sh` 顶部 `VERSIONS_DIR` 或跳过 wrapper 安装。

**Q5: 必须全套装吗？**
不必。你可以 clone 后只 symlink 想要的部分，比如只装 hooks 不装 experts。改 `install.sh` 里 `symlink_kit()` 函数。

**Q6: trigger 字段 CC 原生支持吗？**
目前**不支持**。靠模型看 `MEMORY.md` 索引时的自觉判断（Router 会提醒）。未来 CC 支持时 hook 层可升级强制过滤。

**Q7: 我想定期 git pull 更新怎么办？**
```bash
cd ~/.claude-expert-kit && git pull
```
因为是 symlink，pull 后立即生效，不用重装。

**Q8: 我想给这个 repo 贡献？**
欢迎 PR。但注意：这是个人工作流 kit，很多设计是**主观偏好**（比如 S1/S2/S3 路由自治、40% 硬阻塞阈值）。PR 前先在 Issue 讨论。

---

## Project Structure

```
claude-expert-kit/
├── README.md                    # 你正在看
├── LICENSE                      # MIT
├── install.sh                   # 一键安装（支持 curl|bash）
├── uninstall.sh                 # 一键卸载
├── doctor.sh                    # 健康检查
├── .gitignore
├── CLAUDE.md.template           # 用户自己填 L0 全局约束
├── settings.example.json        # CC settings 示例
├── claude/                      # 镜像 ~/.claude 的可分享部分
│   ├── commands/experts/        # 6 个专家 skill
│   │   ├── 调研.md
│   │   ├── 设计.md
│   │   ├── 开发.md
│   │   ├── 审查.md
│   │   ├── 交付.md
│   │   └── 复盘.md
│   ├── experts/shared/          # 跨项目经验 + SOP 模板
│   │   ├── sop_template.md
│   │   ├── memory-trigger-convention.md
│   │   └── {各种 pattern/antipattern}.md
│   └── hooks/
│       ├── expert-router/router.sh
│       └── context-monitor/context-monitor.sh
├── bin/
│   └── claude-wrapper-install.sh
├── system/
│   └── com.cc.claude-wrapper-self-heal.plist   # macOS LaunchAgent
├── examples/memory/             # 脱敏的 memory 示例
└── docs/
    └── introduction.md          # 设计哲学 + 架构总览
```

---

## 致谢

本体系设计融合了：
- **Mythos Preview**（Anthropic）：审查专家的风险分级 + Finding oracle 分级
- **GenericAgent**（lsdefine）：L0-L4 分层记忆 + SOP 蒸馏
- **Microsoft Playwright**：a11y tree 自动 UI 验证
- **Agentless**（普林斯顿）：修 bug 三段式
- **Sonar/Big Sleep**：假设驱动审查

---

## License

[MIT](LICENSE) — 做你想做的任何事。不负任何责任。

---

*Fork-friendly. 欢迎改造成你自己的专家体系。*
