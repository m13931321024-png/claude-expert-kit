import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { ProjectInfo } from "../../shared/types";

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addRoot, setAddRoot] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setError(null);
    try {
      const list = await api.listProjects();
      setProjects(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const onAdd = async () => {
    if (!addRoot.trim()) return;
    setBusy(true);
    setAddError(null);
    try {
      await api.addProject(addRoot.trim(), false);
      setAddRoot("");
      await reload();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onTogglePin = async (p: ProjectInfo) => {
    setBusy(true);
    try {
      await api.setProjectPin(p.name, !p.pinned);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (p: ProjectInfo) => {
    if (!confirm(`移除 ${p.name}？（不会删除磁盘文件）`)) return;
    setBusy(true);
    try {
      await api.removeProject(p.name);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        加载失败：{error}
      </div>
    );
  }
  if (!projects) return <div className="text-sm text-slate-500">loading…</div>;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Projects</h1>
        <p className="mt-1 text-sm text-slate-500">
          已挂载的项目会同步出现在 Skills 列表的 Project section。自动从 ~/workspace、~/Desktop 发现，可手动添加并 pin 永久保留。
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">挂载列表 ({projects.length})</h2>
        {projects.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            还没有挂载项目。下方手动添加，或在 ~/workspace / ~/Desktop 下放含 .claude/skills 的目录会被自动发现。
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded border border-slate-200 bg-white">
            {projects.map((p) => (
              <li key={p.name} className="flex items-center gap-3 px-4 py-3">
                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-900">{p.name}</span>
                    {p.pinned && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs text-amber-800">
                        pinned
                      </span>
                    )}
                    {p.discovered && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                        auto
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{p.skillCount ?? 0} skill</span>
                  </div>
                  <div className="font-mono text-xs text-slate-500">{p.root}</div>
                </div>
                <button
                  onClick={() => void onTogglePin(p)}
                  disabled={busy}
                  className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {p.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  onClick={() => void onRemove(p)}
                  disabled={busy}
                  className="rounded border border-rose-200 bg-white px-2.5 py-1 text-xs text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">添加项目</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="/绝对路径/到/项目根（含 .claude/skills 或 .claude/commands/experts）"
            value={addRoot}
            onChange={(e) => setAddRoot(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onAdd();
            }}
            className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => void onAdd()}
            disabled={busy || !addRoot.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {addError && (
          <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {addError}
          </div>
        )}
      </section>
    </div>
  );
}
