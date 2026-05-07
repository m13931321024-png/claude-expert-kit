import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type {
  ProjectInfo,
  SkillCreateRequest,
  SkillDetail,
  SkillType,
  SkillUpdateRequest,
  WritableScope,
} from "../../shared/types";

type Mode = "create" | "edit";

export function SkillFormPage({ mode }: { mode: Mode }) {
  const { name: routeName = "" } = useParams();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [scope, setScope] = useState<WritableScope>("global");
  const [projectName, setProjectName] = useState("");
  const [type, setType] = useState<SkillType>("tool");
  const [description, setDescription] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [body, setBody] = useState("");

  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [existing, setExisting] = useState<SkillDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.listProjects().then(setProjects).catch((e: unknown) => {
      setLoadError(e instanceof Error ? e.message : String(e));
    });
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !routeName) return;
    api
      .getSkill(routeName)
      .then((s) => {
        setExisting(s);
        setName(s.name);
        if (s.scope === "global" || s.scope === "project") setScope(s.scope);
        setProjectName(s.projectName ?? "");
        setType(s.type);
        setDescription(s.description);
        setKeywordsText(s.keywords.join(", "));
        setBody(s.body.trim());
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [mode, routeName]);

  const keywords = useMemo(
    () =>
      keywordsText
        .split(/[,\n]/)
        .map((k) => k.trim())
        .filter((k) => k.length > 0),
    [keywordsText],
  );

  const nameValid = useMemo(() => /^[a-z0-9][a-z0-9_-]*$/.test(name), [name]);
  const formValid =
    (mode === "edit" || nameValid) &&
    description.trim().length > 0 &&
    body.trim().length > 0 &&
    (scope === "global" || projectName !== "");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formValid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (mode === "create") {
        const req: SkillCreateRequest = {
          name,
          scope,
          type,
          description,
          keywords,
          body,
        };
        if (scope === "project") req.projectName = projectName;
        const result = await api.createSkill(req);
        navigate(`/skills/${encodeURIComponent(result.name)}`);
      } else {
        const req: SkillUpdateRequest = {
          description,
          keywords,
          type,
          body,
        };
        await api.updateSkill(routeName, req);
        navigate(`/skills/${encodeURIComponent(routeName)}`);
      }
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
  if (mode === "edit" && !existing) {
    return <div className="text-sm text-slate-500">loading…</div>;
  }

  const isEdit = mode === "edit";
  const heading = isEdit ? `Edit ${routeName}` : "New skill";
  const backHref = isEdit ? `/skills/${encodeURIComponent(routeName)}` : "/skills/global";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to={backHref} className="text-sm text-slate-500 hover:text-slate-900">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">{heading}</h1>
      </div>

      <Field label="name" hint="basename，匹配 ^[a-z0-9][a-z0-9_-]*$（创建后不可改）">
        <input
          type="text"
          value={name}
          disabled={isEdit}
          onChange={(e) => setName(e.target.value.toLowerCase())}
          placeholder="my-skill"
          className={`w-full rounded border bg-white px-3 py-2 font-mono text-sm shadow-sm ${
            isEdit
              ? "border-slate-200 bg-slate-50 text-slate-500"
              : nameValid || name === ""
                ? "border-slate-300"
                : "border-rose-300"
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
                disabled={isEdit}
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
            disabled={isEdit}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
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

      <Field label="type">
        <div className="flex gap-4">
          {(["expert", "internal", "tool"] as SkillType[]).map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
              />
              <span className="font-mono">{t}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="description" hint="一句话用途，会写入 frontmatter description">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
        />
      </Field>

      <Field label="keywords" hint="逗号或换行分隔；写入 frontmatter keywords[]">
        <textarea
          value={keywordsText}
          onChange={(e) => setKeywordsText(e.target.value)}
          rows={2}
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none"
        />
        {keywords.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {keywords.map((k) => (
              <span
                key={k}
                className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700"
              >
                {k}
              </span>
            ))}
          </div>
        )}
      </Field>

      <Field label="body" hint="markdown 正文，frontmatter 之后的部分">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={16}
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-xs shadow-sm focus:border-blue-500 focus:outline-none"
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
          {submitting ? "保存中…" : isEdit ? "保存修改" : "创建 skill"}
        </button>
        <Link to={backHref} className="text-sm text-slate-500 hover:text-slate-900">
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
