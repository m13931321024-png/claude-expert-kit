---
sop: backup-claude-config
date: 2026-04-20
trigger: keyword:备份|backup|大改|迁移|升级|恢复|restore
prerequisites:
  - 磁盘有 >200MB 空间（核心配置压缩后 ~100MB）
  - 当前无活跃的专家链路正在写 ~/.claude（避免备份中冲突）
source: 2026-04-20 "强化专家体系"任务的交付阶段首次执行
---

# SOP: 备份 `~/.claude/` 核心配置

## 何时用

对 `~/.claude/` 做**结构性改动前**（改 hooks / 改专家文件 / 重构 memory / 升级 CC 版本 / 迁移新机器）。一次备份 10 秒，误删一份配置要重建几小时 —— ROI 极高。

## 输入（开始前确认）

- [ ] 当前 CC 配置状态是"已知可用"（不是坏的状态）
- [ ] 磁盘空间 >200MB
- [ ] 备份目录存在或可创建：`~/.claude-backups/`
- [ ] 当前没有其他专家链路正在修改 `~/.claude/*`（避免 tar 过程中文件变化）

## 步骤

### Step 1: 创建备份目录

**目的**：统一备份路径，方便未来清理旧备份。

**操作**：
```bash
BACKUP_DIR=~/.claude-backups
mkdir -p "$BACKUP_DIR"
```

**验收**：
- [ ] `~/.claude-backups/` 目录存在
- [ ] 可写入（`touch ~/.claude-backups/.test && rm ~/.claude-backups/.test`）

### Step 2: tar 打包（带 exclude 列表）

**目的**：只备份核心配置，排除 telemetry / cache / session transcript 等可再生/敏感大目录。

**操作**（exclude 列表是关键，不排除会超 GB）：
```bash
STAMP=$(date +%Y-%m-%d-%H%M)
ARCHIVE="$HOME/.claude-backups/claude-backup-$STAMP.tar.gz"

tar czf "$ARCHIVE" \
  --exclude='.claude/telemetry' \
  --exclude='.claude/cache' \
  --exclude='.claude/paste-cache' \
  --exclude='.claude/session-env' \
  --exclude='.claude/sessions' \
  --exclude='.claude/shell-snapshots' \
  --exclude='.claude/todos' \
  --exclude='.claude/downloads' \
  --exclude='.claude/file-history' \
  --exclude='.claude/history.jsonl' \
  --exclude='.claude/plugins/cache' \
  --exclude='.claude/plugins/marketplaces' \
  --exclude='.claude/plugins/data' \
  --exclude='.claude/plugins/pua' \
  --exclude='.claude/backups' \
  --exclude='.claude/stats-cache.json' \
  --exclude='.claude/projects/*/tool-results' \
  -C ~/ .claude
```

**验收**：
- [ ] 命令退出码 0
- [ ] `$ARCHIVE` 文件存在
- [ ] 大小在合理范围（50-200MB，超过 500MB 说明 exclude 漏了）

### Step 3: 验证备份可恢复

**目的**：光生成 tar 不够，要确认关键文件真的打包进去了。

**操作**：
```bash
# 列出前 20 项结构
tar tzf "$ARCHIVE" | head -20

# 检查关键文件是否在
tar tzf "$ARCHIVE" | grep -E \
  "(settings.json$|CLAUDE.md|experts/复盘|sop_template|MEMORY.md|memory/feedback_|hooks/context-monitor|claude-wrapper-install)" \
  | wc -l
```

**验收**：
- [ ] 列表显示 `.claude/` 顶层目录
- [ ] 关键文件 grep 结果 ≥ 8 行（settings / experts / memory / hooks 都在）
- [ ] 档案体积 < 200MB（排除列表有效）

## 整体验收标准

- [ ] `~/.claude-backups/claude-backup-{stamp}.tar.gz` 存在
- [ ] 压缩后 < 200MB
- [ ] 能通过 `tar tzf` 列出内容
- [ ] 含关键文件（settings / commands/experts / experts/shared / projects/*/memory / hooks）

## 失败回滚

| 失败点 | 处理 |
|---|---|
| Step 2 tar 中途失败 | `rm -f "$ARCHIVE"` 后重跑 Step 2 |
| Step 3 显示体积 > 500MB | 检查 exclude 列表是否完整，补上漏掉的目录后重跑 |
| 备份目录不存在 | `mkdir -p ~/.claude-backups` |

## 可复用片段（Copy-Paste 区）

### 一键备份（复制此段即可）

```bash
STAMP=$(date +%Y-%m-%d-%H%M)
ARCHIVE="$HOME/.claude-backups/claude-backup-$STAMP.tar.gz"
mkdir -p "$(dirname "$ARCHIVE")"
tar czf "$ARCHIVE" \
  --exclude='.claude/telemetry' --exclude='.claude/cache' \
  --exclude='.claude/paste-cache' --exclude='.claude/session-env' \
  --exclude='.claude/sessions' --exclude='.claude/shell-snapshots' \
  --exclude='.claude/todos' --exclude='.claude/downloads' \
  --exclude='.claude/file-history' --exclude='.claude/history.jsonl' \
  --exclude='.claude/plugins/cache' --exclude='.claude/plugins/marketplaces' \
  --exclude='.claude/plugins/data' --exclude='.claude/plugins/pua' \
  --exclude='.claude/backups' --exclude='.claude/stats-cache.json' \
  --exclude='.claude/projects/*/tool-results' \
  -C ~/ .claude && echo "✓ Backup: $ARCHIVE ($(du -sh "$ARCHIVE" | cut -f1))"
```

### 从备份恢复（针对单个文件）

```bash
ARCHIVE=~/.claude-backups/claude-backup-YYYY-MM-DD-HHMM.tar.gz
# 恢复某个 memory 文件
tar xzf "$ARCHIVE" -C /tmp/claude-restore --strip-components=0 .claude/projects/...memory/feedback_xxx.md
# 恢复后手动 cp 回去
```

### 从备份整体恢复（核选项，慎用）

```bash
# 先把当前 ~/.claude 移走（而不是 rm，保留可挽回）
mv ~/.claude ~/.claude.broken.$(date +%s)
# 解压恢复
tar xzf "$ARCHIVE" -C ~/
# 验证
ls ~/.claude/
```

## 关联 SOP

- **上游**：无（这是其他大改的前置 SOP）
- **下游**：任何对 `~/.claude/*` 的结构性改动
- **替代**：用 git 管理 `~/.claude/` 是更激进的方案（此 SOP 未采用）

## 演进记录

- 2026-04-20 初版，从"强化专家体系"任务交付阶段蒸馏；exclude 列表基于当前 `~/.claude/` 实际目录结构
