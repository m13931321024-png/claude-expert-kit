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

export function serializeSkillFile(meta: Record<string, unknown>, body: string): string {
  const yamlStr = yaml
    .dump(meta, { lineWidth: -1, noRefs: true, flowLevel: 1 })
    .trimEnd();
  const trimmedBody = body.replace(/^\s+/, "").replace(/\s+$/, "");
  return `---\n${yamlStr}\n---\n\n${trimmedBody}\n`;
}

async function writeSkillToDisk(
  name: string,
  scope: WritableScope,
  projectRoot: string | undefined,
  content: string,
): Promise<{ dir: string; file: string }> {
  const nameErr = validateSkillName(name);
  if (nameErr !== null) throw new Error(`bad_name: ${nameErr}`);
  if (scope === "project" && projectRoot === undefined) {
    throw new Error("missing_project_root");
  }
  const { dir, file } = resolveSkillDir(name, scope, projectRoot);
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(file, content, { encoding: "utf8", flag: "wx" });
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST") throw new Error("already_exists");
    throw e;
  }
  invalidateSkillCache(file);
  return { dir, file };
}

export async function createSkill(
  req: SkillCreateRequest,
  projectRoot: string | undefined,
): Promise<SkillWriteResult> {
  const meta: Record<string, unknown> = {
    name: req.name,
    type: req.type,
    description: req.description,
    keywords: req.keywords,
  };
  const content = serializeSkillFile(meta, req.body);
  const { file } = await writeSkillToDisk(req.name, req.scope, projectRoot, content);
  const out: SkillWriteResult = { name: req.name, path: file, scope: req.scope };
  if (req.projectName !== undefined) out.projectName = req.projectName;
  return out;
}

export async function importSkillToDisk(
  fetched: FetchedSkill,
  scope: WritableScope,
  projectRoot: string | undefined,
  projectName: string | undefined,
  nameOverride: string | undefined,
): Promise<SkillWriteResult> {
  const finalName =
    nameOverride !== undefined && nameOverride !== "" ? nameOverride : fetched.name;
  const meta: Record<string, unknown> = { ...fetched.rawMeta, name: finalName };
  const content = serializeSkillFile(meta, fetched.body);
  const { file } = await writeSkillToDisk(finalName, scope, projectRoot, content);
  const out: SkillWriteResult = { name: finalName, path: file, scope };
  if (projectName !== undefined) out.projectName = projectName;
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
  const parsedFM = parseFrontmatter(existing.raw);
  const baseMeta: Record<string, unknown> =
    parsedFM && typeof parsedFM.meta === "object" && parsedFM.meta !== null
      ? { ...(parsedFM.meta as Record<string, unknown>) }
      : {};
  baseMeta.name = existing.name;
  if (req.type !== undefined) baseMeta.type = req.type;
  if (req.description !== undefined) baseMeta.description = req.description;
  if (req.keywords !== undefined) baseMeta.keywords = req.keywords;
  const body = req.body ?? existing.body;
  const content = serializeSkillFile(baseMeta, body);
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
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  const rand = Math.random().toString(36).slice(2, 6);
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${ms}-${rand}`
  );
}

const GITHUB_HOSTS = new Set(["github.com", "raw.githubusercontent.com"]);
const MAX_GITHUB_REDIRECTS = 3;
const MAX_GITHUB_BODY_BYTES = 64 * 1024;
const GITHUB_FETCH_TIMEOUT_MS = 10_000;

function rewriteBlobToRaw(parsed: URL): URL {
  if (parsed.hostname !== "github.com") return parsed;
  const m = /^\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(parsed.pathname);
  if (!m) return parsed;
  const next = new URL(parsed.toString());
  next.hostname = "raw.githubusercontent.com";
  next.pathname = `/${m[1]}/${m[2]}/${m[3]}`;
  return next;
}

export interface FetchedSkill {
  name: string;
  type: SkillType;
  description: string;
  keywords: string[];
  body: string;
  finalUrl: string;
  rawMeta: Record<string, unknown>;
}

export async function fetchSkillFromGitHub(rawUrl: string): Promise<FetchedSkill> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("bad_url");
  }
  if (url.protocol !== "https:") throw new Error("bad_url: must be https");
  if (!GITHUB_HOSTS.has(url.hostname)) throw new Error("bad_host: not github");
  url = rewriteBlobToRaw(url);
  if (!GITHUB_HOSTS.has(url.hostname)) throw new Error("bad_host: not github");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GITHUB_FETCH_TIMEOUT_MS);
  try {
    let current = url;
    for (let hop = 0; hop <= MAX_GITHUB_REDIRECTS; hop++) {
      if (!GITHUB_HOSTS.has(current.hostname)) throw new Error("bad_host: redirect off-allowlist");
      const res = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "text/plain, text/markdown, */*" },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (loc === null) throw new Error("redirect_no_location");
        current = new URL(loc, current);
        continue;
      }
      if (!res.ok) throw new Error(`fetch_failed: HTTP ${res.status}`);

      const cl = res.headers.get("content-length");
      if (cl !== null && Number(cl) > MAX_GITHUB_BODY_BYTES) {
        throw new Error("body_too_large");
      }
      const text = await readBoundedText(res, MAX_GITHUB_BODY_BYTES);
      const parsed = parseFrontmatter(text);
      if (!parsed) throw new Error("not_a_skill: no frontmatter");
      const meta = parsed.meta;
      const name = asString(meta.name);
      if (!name) throw new Error("not_a_skill: missing frontmatter.name");
      const type = asTypeOrNull(meta.type) ?? "tool";
      const description = asString(meta.description);
      const keywords = keywordsFromMeta(meta);
      return {
        name,
        type,
        description,
        keywords,
        body: parsed.body,
        finalUrl: current.toString(),
        rawMeta: meta as Record<string, unknown>,
      };
    }
    throw new Error("too_many_redirects");
  } finally {
    clearTimeout(timeout);
  }
}

async function readBoundedText(res: Response, limit: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value === undefined) continue;
    total += value.length;
    if (total > limit) {
      void reader.cancel();
      throw new Error("body_too_large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
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
