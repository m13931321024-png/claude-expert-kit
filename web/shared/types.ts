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
}

export interface ProjectInfo {
  name: string;
  root: string;
  pinned: boolean;
  discovered: boolean;
  skillCount?: number;
}

export interface ProjectsConfig {
  projects: ProjectInfo[];
}

export interface HealthInfo {
  ok: true;
  version: string;
  repoRoot: string;
  cwd: string;
  homeDir: string;
  projectName: string;
  projectCount: number;
  configPath: string;
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
