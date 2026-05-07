import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Skill, SkillScope, SkillType } from "../../shared/types";

type Filter = "all" | SkillType;
export type SkillsMode = "global" | "projects";

const SCOPE_LABEL: Record<SkillScope, string> = {
  project: "Projects",
  global: "Global",
  example: "Example",
};
const SCOPE_HINT: Record<SkillScope, string> = {
  project: "已挂载项目的本地 skill",
  global: "机器级共享，跨项目可见",
  example: "仓库自带 demo（canonical-skills/）",
};
const TYPE_ORDER: SkillType[] = ["expert", "internal", "tool"];
const TYPE_LABEL: Record<SkillType, string> = {
  expert: "experts",
  internal: "_internal",
  tool: "tool",
};

const MODE_SCOPES: Record<SkillsMode, SkillScope[]> = {
  global: ["global", "example"],
  projects: ["project"],
};

const MODE_TITLE: Record<SkillsMode, string> = {
  global: "Global Skills",
  projects: "Project Skills",
};

const MODE_HINT: Record<SkillsMode, string> = {
  global: "机器级共享 skill 与示例 demo",
  projects: "已挂载项目（在 Projects 页管理）的本地 skill",
};

export function SkillsPage({ mode }: { mode: SkillsMode }) {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [collapsedExample, setCollapsedExample] = useState(true);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("cek:collapsed-projects");
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });
  const toggleProject = (name: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      try {
        localStorage.setItem("cek:collapsed-projects", JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const scopes = MODE_SCOPES[mode];
  const allowedScopes = useMemo(() => new Set(scopes), [scopes]);

  useEffect(() => {
    api.listSkills().then(setSkills).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  }, []);

  const filtered = useMemo(() => {
    if (!skills) return [];
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (!allowedScopes.has(s.scope)) return false;
      if (filter !== "all" && s.type !== filter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [skills, query, filter, allowedScopes]);

  const inMode = useMemo(
    () => (skills ?? []).filter((s) => allowedScopes.has(s.scope)),
    [skills, allowedScopes],
  );

  const byScope = useMemo(() => {
    const out: Record<SkillScope, Skill[]> = { project: [], global: [], example: [] };
    for (const s of filtered) out[s.scope].push(s);
    for (const k of scopes) out[k].sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [filtered, scopes]);

  if (error) {
    return (
      <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        加载失败：{error}
        <div className="mt-1 text-xs text-rose-500">
          确认 sidecar 正在 127.0.0.1:24210 运行（pnpm dev:api）。
        </div>
      </div>
    );
  }

  if (!skills) {
    return <div className="text-sm text-slate-500">loading…</div>;
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{MODE_TITLE[mode]}</h1>
          <p className="mt-1 text-sm text-slate-500">{MODE_HINT[mode]}</p>
        </div>
        <Link
          to="/skills/new"
          className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          + New skill
        </Link>
      </header>

      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="搜索 name / description / keyword"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
        />
        <FilterTabs value={filter} onChange={setFilter} />
        <span className="text-xs text-slate-500">
          {filtered.length} / {inMode.length}
        </span>
      </div>

      {scopes.map((scope) => (
        <ScopeSection
          key={scope}
          scope={scope}
          skills={byScope[scope]}
          collapsed={scope === "example" && collapsedExample}
          onToggle={
            scope === "example" ? () => setCollapsedExample((c) => !c) : undefined
          }
          collapsedProjects={collapsedProjects}
          onToggleProject={toggleProject}
        />
      ))}

      {filtered.length === 0 && (
        <div className="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          没有匹配的 skill
        </div>
      )}
    </div>
  );
}

function FilterTabs({ value, onChange }: { value: Filter; onChange: (v: Filter) => void }) {
  const opts: { v: Filter; label: string }[] = [
    { v: "all", label: "All" },
    { v: "expert", label: "experts" },
    { v: "internal", label: "_internal" },
    { v: "tool", label: "tool" },
  ];
  return (
    <div className="flex rounded border border-slate-300 bg-white p-0.5 text-xs">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded px-2.5 py-1 transition ${
            value === o.v ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ScopeSection({
  scope,
  skills,
  collapsed,
  onToggle,
  collapsedProjects,
  onToggleProject,
}: {
  scope: SkillScope;
  skills: Skill[];
  collapsed: boolean;
  onToggle?: () => void;
  collapsedProjects: Set<string>;
  onToggleProject: (name: string) => void;
}) {
  return (
    <section>
      <header
        className={`mb-2 flex items-baseline justify-between border-b border-slate-200 pb-1 ${
          onToggle ? "cursor-pointer" : ""
        }`}
        onClick={onToggle}
      >
        <h2 className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-slate-800">{SCOPE_LABEL[scope]}</span>
          <span className="text-xs text-slate-400">{skills.length}</span>
          <span className="text-xs text-slate-400">— {SCOPE_HINT[scope]}</span>
        </h2>
        {onToggle && (
          <span className="font-mono text-xs text-slate-400">{collapsed ? "▸" : "▾"}</span>
        )}
      </header>

      {collapsed ? null : skills.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
          {scope === "project"
            ? "还没挂载项目（去 Projects 页添加，或在 ~/workspace 下放含 .claude/skills 的目录会被自动发现）"
            : "无内容"}
        </div>
      ) : scope === "project" ? (
        <ProjectGroups
          skills={skills}
          collapsedProjects={collapsedProjects}
          onToggleProject={onToggleProject}
        />
      ) : (
        <div className="space-y-3">
          {TYPE_ORDER.map((t) => {
            const list = skills.filter((s) => s.type === t);
            return list.length === 0 ? null : <TypeGroup key={t} type={t} skills={list} />;
          })}
        </div>
      )}
    </section>
  );
}

function ProjectGroups({
  skills,
  collapsedProjects,
  onToggleProject,
}: {
  skills: Skill[];
  collapsedProjects: Set<string>;
  onToggleProject: (name: string) => void;
}) {
  const byProject = new Map<string, Skill[]>();
  for (const s of skills) {
    const k = s.projectName ?? "(unknown)";
    const arr = byProject.get(k) ?? [];
    arr.push(s);
    byProject.set(k, arr);
  }
  const names = Array.from(byProject.keys()).sort();
  return (
    <div className="space-y-4">
      {names.map((name) => {
        const list = byProject.get(name) ?? [];
        const collapsed = collapsedProjects.has(name);
        return (
          <div key={name} className="rounded border border-slate-200 bg-white p-3">
            <button
              type="button"
              onClick={() => onToggleProject(name)}
              className="mb-2 flex w-full items-baseline justify-between gap-2 text-left"
              aria-expanded={!collapsed}
            >
              <span className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-semibold text-slate-900">{name}</span>
                <span className="text-xs text-slate-400">{list.length} skill</span>
              </span>
              <span className="font-mono text-xs text-slate-400">{collapsed ? "▸" : "▾"}</span>
            </button>
            {collapsed ? null : (
              <div className="space-y-2">
                {TYPE_ORDER.map((t) => {
                  const sub = list.filter((s) => s.type === t);
                  return sub.length === 0 ? null : <TypeGroup key={t} type={t} skills={sub} />;
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TypeGroup({ type, skills }: { type: SkillType; skills: Skill[] }) {
  return (
    <div>
      <h3 className="mb-1 flex items-baseline gap-2 text-xs font-semibold text-slate-500">
        <span className="font-mono">{TYPE_LABEL[type]}</span>
        <span className="font-normal text-slate-400">{skills.length}</span>
      </h3>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded border border-slate-200 bg-white">
        {skills.map((s) => (
          <li key={`${s.scope}:${s.path}`}>
            <Link
              to={`/skills/${encodeURIComponent(s.name)}`}
              className="flex items-baseline gap-3 px-4 py-2.5 transition hover:bg-slate-50"
            >
              <span className="w-44 truncate font-mono text-sm text-slate-900">{s.name}</span>
              <span className="flex-1 truncate text-sm text-slate-600">{s.description}</span>
              {s.keywords.length > 0 && (
                <span className="shrink-0 font-mono text-xs text-slate-400">
                  {s.keywords.length} kw
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
