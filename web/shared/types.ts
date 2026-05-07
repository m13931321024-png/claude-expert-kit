export type SkillType = "expert" | "internal" | "tool";
export type SkillScope = "global" | "project" | "example";

export interface SkillSource {
  scope: SkillScope;
  dirs: string[];
  defaultType?: SkillType;
  projectName?: string;
}

export interface Skill {
  name: string;
  type: SkillType;
  scope: SkillScope;
  projectName?: string;
  description: string;
  keywords: string[];
  path: string;
  writable: boolean;
}

export interface ProjectInfo {
  name: string;
  root: string;
  skillCount?: number;
}

export interface HealthInfo {
  ok: true;
  version: string;
  repoRoot: string;
  cwd: string;
  homeDir: string;
  projectName: string;
  projectCount: number;
}

export interface SkillDetail extends Skill {
  priority: "high" | "medium" | "low";
  chain: string[];
  calls: string[];
  version: string;
  platforms: string[];
  maintainer: string;
  body: string;
  raw: string;
}

export interface ApiError {
  error: string;
  detail?: string;
}

export type WritableScope = "global" | "project";

export interface SkillCreateRequest {
  name: string;
  scope: WritableScope;
  projectName?: string;
  type: SkillType;
  description: string;
  keywords: string[];
  body: string;
}

export interface SkillUpdateRequest {
  description?: string;
  keywords?: string[];
  type?: SkillType;
  body?: string;
}

export interface SkillWriteResult {
  name: string;
  path: string;
  scope: WritableScope;
  projectName?: string;
}

export interface SkillDeleteResult {
  name: string;
  trashedTo: string;
}
