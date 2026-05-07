import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { homedir } from "node:os";
import yaml from "js-yaml";
import type {
  Skill,
  SkillCreateRequest,
  SkillDeleteResult,
  SkillDetail,
  SkillScope,
  SkillSource,
  SkillType,
  SkillUpdateRequest,
  SkillWriteResult,
  WritableScope,
} from "../../shared/types.js";

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
  parsed: Omit<SkillDetail, "scope" | "projectName" | "type" | "writable"> & {
    rawType: SkillType | null;
  };
}
const PARSE_CACHE = new Map<string, ParsedCacheEntry>();

async function readSkillFile(
  path: string,
  scope: SkillScope,
  defaultType: SkillType,
  projectName: string | undefined,
  allowedRoots: string[],
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
  const writable =
    (scope === "global" || scope === "project") &&
    allowedRoots.some((r) => isUnder(path, r));
  const detail: SkillDetail = { ...rest, type, scope, writable };
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

export async function loadAllSkills(
  sources: SkillSource[],
  allowedRoots: string[],
): Promise<SkillDetail[]> {
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
    jobs.map((j) => readSkillFile(j.path, j.scope, j.defaultType, j.projectName, allowedRoots)),
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
    writable: s.writable,
  };
  if (s.projectName !== undefined) item.projectName = s.projectName;
  return item;
}

export function clearParseCache(): void {
  PARSE_CACHE.clear();
}

export function invalidateSkillCache(path: string): void {
  PARSE_CACHE.delete(path);
}

const SKILL_NAME_RE = /^[a-z0-9][a-z0-9_-]*$/;
const HOME = homedir();
const TRASH_ROOT = join(HOME, ".skillctl/trash");
const GLOBAL_SKILL_ROOT = join(HOME, ".claude/skills");

export function validateSkillName(name: string): string | null {
  if (typeof name !== "string" || name.length === 0) return "name required";
  if (name.length > 80) return "name too long (max 80)";
  if (!SKILL_NAME_RE.test(name)) return "name must match ^[a-z0-9][a-z0-9_-]*$";
  return null;
}

function isUnder(absChild: string, absParent: string): boolean {
  const c = resolve(absChild) + sep;
  const p = resolve(absParent) + sep;
  return c.startsWith(p);
}

export function resolveSkillDir(
  name: string,
  scope: WritableScope,
  projectRoot?: string,
): { dir: string; file: string } {
  const root = scope === "project"
    ? (projectRoot === undefined ? "" : join(projectRoot, ".claude/skills"))
    : GLOBAL_SKILL_ROOT;
  if (root === "") throw new Error("project scope requires projectRoot");
  const dir = resolve(root, name);
  if (!isUnder(dir, root)) throw new Error("path traversal blocked");
  return { dir, file: join(dir, "SKILL.md") };
}

interface FrontmatterFields {
  name: string;
  type: SkillType;
  description: string;
  keywords: string[];
}

function buildFrontmatterYaml(fm: FrontmatterFields): string {
  const lines = [
    `name: ${fm.name}`,
    `type: ${fm.type}`,
    `description: ${yaml.dump(fm.description, { lineWidth: -1 }).trim()}`,
  ];
  if (fm.keywords.length > 0) {
    lines.push(`keywords: ${yaml.dump(fm.keywords, { flowLevel: 0 }).trim()}`);
  } else {
    lines.push("keywords: []");
  }
  return lines.join("\n");
}

export function serializeSkillFile(fm: FrontmatterFields, body: string): string {
  const yamlBlock = buildFrontmatterYaml(fm);
  const trimmedBody = body.replace(/^\s+/, "").replace(/\s+$/, "");
  return `---\n${yamlBlock}\n---\n\n${trimmedBody}\n`;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function createSkill(
  req: SkillCreateRequest,
  projectRoot: string | undefined,
): Promise<SkillWriteResult> {
  const nameErr = validateSkillName(req.name);
  if (nameErr !== null) throw new Error(`bad_name: ${nameErr}`);
  if (req.scope === "project" && projectRoot === undefined) {
    throw new Error("missing_project_root");
  }
  const { dir, file } = resolveSkillDir(req.name, req.scope, projectRoot);
  if (await pathExists(file)) throw new Error("already_exists");
  await mkdir(dir, { recursive: true });
  const content = serializeSkillFile(
    { name: req.name, type: req.type, description: req.description, keywords: req.keywords },
    req.body,
  );
  await writeFile(file, content, "utf8");
  invalidateSkillCache(file);
  const out: SkillWriteResult = { name: req.name, path: file, scope: req.scope };
  if (req.projectName !== undefined) out.projectName = req.projectName;
  return out;
}

export async function updateSkill(
  existing: SkillDetail,
  req: SkillUpdateRequest,
  allowedRoots: string[],
): Promise<SkillWriteResult> {
  if (existing.scope !== "project" && existing.scope !== "global") {
    throw new Error("not_writable_scope");
  }
  const allowed = allowedRoots.some((r) => isUnder(existing.path, r));
  if (!allowed) throw new Error("not_writable");
  const fm: FrontmatterFields = {
    name: existing.name,
    type: req.type ?? existing.type,
    description: req.description ?? existing.description,
    keywords: req.keywords ?? existing.keywords,
  };
  const body = req.body ?? existing.body;
  const content = serializeSkillFile(fm, body);
  await writeFile(existing.path, content, "utf8");
  invalidateSkillCache(existing.path);
  const out: SkillWriteResult = {
    name: existing.name,
    path: existing.path,
    scope: existing.scope,
  };
  if (existing.projectName !== undefined) out.projectName = existing.projectName;
  return out;
}

function tsStamp(): string {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export async function deleteSkill(
  existing: SkillDetail,
  allowedRoots: string[],
): Promise<SkillDeleteResult> {
  const allowed = allowedRoots.some((r) => isUnder(existing.path, r));
  if (!allowed) throw new Error("not_writable");
  const parentDir = dirname(existing.path);
  const isFlat = allowedRoots.some((r) => resolve(parentDir) === resolve(r));
  const moveSrc = isFlat ? existing.path : parentDir;
  if (!allowedRoots.some((r) => isUnder(moveSrc, r))) throw new Error("not_writable");
  const stamp = tsStamp();
  const safeProject = (existing.projectName ?? "global").replace(/[^a-zA-Z0-9_-]/g, "_");
  const leaf = isFlat ? `${existing.scope}__${safeProject}__${existing.name}.md`
    : `${existing.scope}__${safeProject}__${existing.name}`;
  const trashDest = join(TRASH_ROOT, stamp, leaf);
  await mkdir(dirname(trashDest), { recursive: true });
  await rename(moveSrc, trashDest);
  invalidateSkillCache(existing.path);
  return { name: existing.name, trashedTo: trashDest };
}
