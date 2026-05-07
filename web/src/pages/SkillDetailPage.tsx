import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { SkillDetail } from "../../shared/types";

export function SkillDetailPage() {
  const { name = "" } = useParams();
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSkill(null);
    setError(null);
    api.getSkill(name).then(setSkill).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  }, [name]);

  if (error) {
    return (
      <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error}
      </div>
    );
  }
  if (!skill) return <div className="text-sm text-slate-500">loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/skills" className="text-sm text-slate-500 hover:text-slate-900">
          ← Skills
        </Link>
        <span className="font-mono text-base font-semibold text-slate-900">{skill.name}</span>
        <TypeBadge type={skill.type} />
        <ScopeBadge scope={skill.scope} />
      </div>

      <p className="text-sm text-slate-700">{skill.description}</p>

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <Row label="priority" value={skill.priority} mono />
        <Row label="version" value={skill.version} mono />
        <Row
          label="platforms"
          value={
            skill.platforms.length === 0 ? (
              "—"
            ) : (
              <div className="flex flex-wrap gap-1">
                {skill.platforms.map((p) => (
                  <PlatformBadge key={p} platform={p} />
                ))}
              </div>
            )
          }
        />
        <Row label="maintainer" value={skill.maintainer || "—"} />
        <Row
          label="chain"
          value={skill.chain.length === 0 ? "—" : skill.chain.join(" → ")}
          mono
        />
        <Row
          label="calls"
          value={skill.calls.length === 0 ? "—" : skill.calls.join(", ")}
          mono
        />
        <Row
          label="keywords"
          value={
            skill.keywords.length === 0 ? (
              "—"
            ) : (
              <div className="flex flex-wrap gap-1">
                {skill.keywords.map((k) => (
                  <span
                    key={k}
                    className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700"
                  >
                    {k}
                  </span>
                ))}
              </div>
            )
          }
        />
        <Row label="path" value={<span className="font-mono text-xs">{skill.path}</span>} />
      </div>

      <details className="rounded border border-slate-200 bg-white">
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700">
          Body source
        </summary>
        <pre className="overflow-x-auto border-t border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800">
          {skill.body.trim()}
        </pre>
      </details>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-4 border-b border-slate-100 px-4 py-2 last:border-b-0">
      <span className="w-24 shrink-0 font-mono text-xs uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className={`flex-1 text-sm text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function TypeBadge({ type }: { type: SkillDetail["type"] }) {
  const styles =
    type === "expert"
      ? "bg-blue-100 text-blue-700"
      : type === "internal"
        ? "bg-slate-100 text-slate-700"
        : "bg-amber-100 text-amber-800";
  return (
    <span className={`rounded px-1.5 py-0.5 font-mono text-xs ${styles}`}>{type}</span>
  );
}

function ScopeBadge({ scope }: { scope: SkillDetail["scope"] }) {
  const styles =
    scope === "project"
      ? "bg-emerald-100 text-emerald-800"
      : scope === "global"
        ? "bg-violet-100 text-violet-800"
        : "bg-slate-100 text-slate-500";
  return (
    <span className={`rounded px-1.5 py-0.5 font-mono text-xs ${styles}`}>{scope}</span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const styles =
    platform === "claude-code"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : platform === "codex"
        ? "bg-violet-50 text-violet-700 border-violet-200"
        : platform === "cursor"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-slate-50 text-slate-700 border-slate-200";
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-xs ${styles}`}>{platform}</span>
  );
}
