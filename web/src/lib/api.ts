import type { HealthInfo, ProjectInfo, Skill, SkillDetail } from "../../shared/types";

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path}: HTTP ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => jsonFetch<HealthInfo>("/api/health"),
  listSkills: () => jsonFetch<Skill[]>("/api/skills"),
  getSkill: (name: string) => jsonFetch<SkillDetail>(`/api/skills/${encodeURIComponent(name)}`),
  listProjects: () => jsonFetch<ProjectInfo[]>("/api/projects"),
  addProject: (root: string, pin = false) =>
    jsonFetch<ProjectInfo>("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root, pin }),
    }),
  removeProject: (name: string) =>
    jsonFetch<{ ok: boolean }>(`/api/projects/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),
  setProjectPin: (name: string, pin: boolean) =>
    jsonFetch<ProjectInfo>(`/api/projects/${encodeURIComponent(name)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    }),
};
