import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { ProjectInfo, SkillImportRequest, WritableScope } from "../../shared/types";

export function SkillImportPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [scope, setScope] = useState<WritableScope>("global");
  const [projectName, setProjectName] = useState("");
  const [nameOverride, setNameOverride] = useState("");

  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.listProjects().then(setProjects).catch((e: unknown) => {
      setLoadError(e instanceof Error ? e.message : String(e));
    });
  }, []);

  const urlValid = useMemo(() => {
    try {
      const u = new URL(url);
      return (
        u.protocol === "https:" &&
        (u.hostname === "github.com" || u.hostname === "raw.githubusercontent.com")
      );
    } catch {
      return false;
    }
  }, [url]);

  const overrideValid = nameOverride === "" || /^[a-z0-9][a-z0-9_-]*$/.test(nameOverride);
  const formValid =
    urlValid && overrideValid && (scope === "global" || projectName !== "");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formValid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const req: SkillImportRequest = { url, scope };
      if (scope === "project") req.projectName = projectName;
      if (nameOverride !== "") req.nameOverride = nameOverride;
      const result = await api.importSkill(req);
      navigate(`/skills/${encodeURIComponent(result.name)}`);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {loadError}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/skills/global" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">Import skill from GitHub</h1>
      </div>

      <p className="text-sm text-slate-600">
        从 GitHub 拉取一个含 frontmatter 的 markdown skill 文件。支持 raw URL 与 blob URL（自动转 raw）。
        host 限定 <code className="font-mono text-xs">github.com</code> /{" "}
        <code className="font-mono text-xs">raw.githubusercontent.com</code>，body ≤ 64KB，redirect ≤ 3 跳。
      </p>

      <Field
        label="url"
        hint="例：https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>.md"
      >
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://raw.githubusercontent.com/..."
          className={`w-full rounded border bg-white px-3 py-2 font-mono text-xs shadow-sm ${
            urlValid || url === "" ? "border-slate-300" : "border-rose-300"
          } focus:border-blue-500 focus:outline-none`}
        />
      </Field>

      <Field label="scope" hint="global = ~/.claude/skills；project = 选定项目的 .claude/skills">
        <div className="flex gap-4">
          {(["global", "project"] as WritableScope[]).map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="scope"
                value={s}
                checked={scope === s}
                onChange={() => setScope(s)}
              />
              <span className="font-mono">{s}</span>
            </label>
          ))}
        </div>
      </Field>

      {scope === "project" && (
        <Field label="project" hint={`从已挂载项目选（${projects.length} 个可用）`}>
          <select
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">— 选择项目 —</option>
            {projects.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field
        label="nameOverride"
        hint="可选：覆盖 frontmatter 里的 name（留空则用 frontmatter.name）"
      >
        <input
          type="text"
          value={nameOverride}
          onChange={(e) => setNameOverride(e.target.value.toLowerCase())}
          placeholder="留空使用 frontmatter.name"
          className={`w-full rounded border bg-white px-3 py-2 font-mono text-sm shadow-sm ${
            overrideValid ? "border-slate-300" : "border-rose-300"
          } focus:border-blue-500 focus:outline-none`}
        />
      </Field>

      {submitError && (
        <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {submitError}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!formValid || submitting}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? "导入中…" : "导入"}
        </button>
        <Link to="/skills/global" className="text-sm text-slate-500 hover:text-slate-900">
          取消
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
