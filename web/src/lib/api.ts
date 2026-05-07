import type {
  HealthInfo,
  ProjectInfo,
  Skill,
  SkillCreateRequest,
  SkillDeleteResult,
  SkillDetail,
  SkillImportRequest,
  SkillUpdateRequest,
  SkillWriteResult,
} from "../../shared/types";

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" }, ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path}: HTTP ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

function jsonBody(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  };
}

export const api = {
  health: () => jsonFetch<HealthInfo>("/api/health"),
  listProjects: () => jsonFetch<ProjectInfo[]>("/api/projects"),
  listSkills: () => jsonFetch<Skill[]>("/api/skills"),
  getSkill: (name: string) => jsonFetch<SkillDetail>(`/api/skills/${encodeURIComponent(name)}`),
  createSkill: (req: SkillCreateRequest) =>
    jsonFetch<SkillWriteResult>("/api/skills", jsonBody(req)),
  importSkill: (req: SkillImportRequest) =>
    jsonFetch<SkillWriteResult>("/api/skills/import", jsonBody(req)),
  updateSkill: (name: string, req: SkillUpdateRequest) =>
    jsonFetch<SkillWriteResult>(`/api/skills/${encodeURIComponent(name)}`, {
      ...jsonBody(req),
      method: "PATCH",
    }),
  deleteSkill: (name: string) =>
    jsonFetch<SkillDeleteResult>(`/api/skills/${encodeURIComponent(name)}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }),
};
