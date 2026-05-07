import { readdir, readFile, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import yaml from "js-yaml";
import type { Skill, SkillDetail, SkillScope, SkillSource, SkillType } from "../../shared/types.js";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const MAX_SCAN_DEPTH = 3;
const EXCLUDE_DIRNAMES = new Set([
  "node_modules", ".git", "dist", "build", ".next", "out", "coverage",
  ".cache", ".turbo", ".vite",
]);

interface RawFrontmatter {
  name?: unknown;
  type?: unknown;
  description?: unknown;
  priority?: unknown;
  chain?: unknown;
  calls?: unknown;
  keywords?: unknown;
  triggers?: unknown;
  version?: unknown;
  platforms?: unknown;
  maintainer?: unknown;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function asTypeOrNull(v: unknown): SkillType | null {
  return v === "expert" || v === "internal" || v === "tool" ? v : null;
}

function asPriority(v: unknown): "high" | "medium" | "low" {
  return v === "high" || v === "low" ? v : "medium";
}

function keywordsFromMeta(meta: RawFrontmatter): string[] {
  const arr = asStringArray(meta.keywords);
  if (arr.length > 0) return arr;
  if (typeof meta.triggers === "string") {
    return meta.triggers
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
}

function inferTypeFromPath(path: string, fallback: SkillType): SkillType {
  if (path.includes(`${sep}_legacy${sep}`) || path.includes(`${sep}_internal${sep}`)) return "internal";
  if (path.includes(`${sep}experts${sep}`)) return "expert";
  return fallback;
}

function parseFrontmatter(raw: string): { meta: RawFrontmatter; body: string } | null {
  const m = FRONTMATTER_RE.exec(raw);
  if (!m) return null;
  const fmText = m[1];
  const body = m[2] ?? "";
  if (fmText === undefined) return null;
  try {
    const meta = yaml.load(fmText) as RawFrontmatter;
    return { meta: meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {}, body };
  } catch {
    return null;
  }
}

interface ParsedCacheEntry {
  mtimeMs: number;
  parsed: Omit<SkillDetail, "scope" | "projectName" | "type"> & { rawType: SkillType | null };
}
const PARSE_CACHE = new Map<string, ParsedCacheEntry>();

async function readSkillFile(
  path: string,
  scope: SkillScope,
  defaultType: SkillType,
  projectName: string | undefined,
): Promise<SkillDetail | null> {
  const st = await stat(path);
  const cached = PARSE_CACHE.get(path);
  let entry = cached && cached.mtimeMs === st.mtimeMs ? cached : null;
  if (!entry) {
    const raw = await readFile(path, "utf8");
    const parsed = parseFrontmatter(raw);
    if (!parsed) return null;
    const { meta, body } = parsed;
    const name = asString(meta.name);
    if (!name) return null;
    entry = {
      mtimeMs: st.mtimeMs,
      parsed: {
        name,
        rawType: asTypeOrNull(meta.type),
        description: asString(meta.description),
        keywords: keywordsFromMeta(meta),
        priority: asPriority(meta.priority),
        chain: asStringArray(meta.chain),
        calls: asStringArray(meta.calls),
        version: asString(meta.version, "0.1.0"),
        platforms: asStringArray(meta.platforms),
        maintainer: asString(meta.maintainer),
        body,
        raw,
        path,
      },
    };
    PARSE_CACHE.set(path, entry);
  }
  const { rawType, ...rest } = entry.parsed;
  const type = rawType ?? inferTypeFromPath(path, defaultType);
  const detail: SkillDetail = { ...rest, type, scope };
  if (projectName !== undefined) detail.projectName = projectName;
  return detail;
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

async function listSkillFiles(rootDir: string, maxDepth = MAX_SCAN_DEPTH): Promise<string[]> {
  if (!(await dirExists(rootDir))) return [];
  const out: string[] = [];

  async function walk(dir: string, remaining: number): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const subdirs: string[] = [];
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith(".md")) {
        out.push(join(dir, e.name));
      } else if (e.isDirectory() && !EXCLUDE_DIRNAMES.has(e.name) && !e.name.startsWith(".")) {
        subdirs.push(join(dir, e.name));
      }
    }
    if (remaining <= 0) return;
    await Promise.all(subdirs.map((s) => walk(s, remaining - 1)));
  }

  await walk(rootDir, maxDepth);
  return out;
}

export async function loadAllSkills(sources: SkillSource[]): Promise<SkillDetail[]> {
  type Job = { path: string; scope: SkillScope; defaultType: SkillType; projectName?: string };
  const jobs: Job[] = [];
  for (const src of sources) {
    for (const dir of src.dirs) {
      const files = await listSkillFiles(dir);
      for (const f of files) {
        const job: Job = { path: f, scope: src.scope, defaultType: src.defaultType ?? "tool" };
        if (src.projectName !== undefined) job.projectName = src.projectName;
        jobs.push(job);
      }
    }
  }
  const settled = await Promise.allSettled(
    jobs.map((j) => readSkillFile(j.path, j.scope, j.defaultType, j.projectName)),
  );
  const out: SkillDetail[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      if (r.value !== null) out.push(r.value);
    } else {
      const job = jobs[i];
      console.warn(`[skills] skip ${job?.path}: ${String(r.reason)}`);
    }
  });
  return out;
}

export function toListItem(s: SkillDetail): Skill {
  const item: Skill = {
    name: s.name,
    type: s.type,
    scope: s.scope,
    description: s.description,
    keywords: s.keywords,
    path: s.path,
  };
  if (s.projectName !== undefined) item.projectName = s.projectName;
  return item;
}

export function clearParseCache(): void {
  PARSE_CACHE.clear();
}
