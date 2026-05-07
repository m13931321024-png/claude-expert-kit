import { readdir, readFile, writeFile, rename, mkdir, stat } from "node:fs/promises";
import { dirname, join, basename, resolve } from "node:path";
import { homedir } from "node:os";
import type { ProjectInfo, ProjectsConfig } from "../../shared/types.js";

const HOME = homedir();
const CONFIG_PATH = join(HOME, ".skillctl/web-projects.json");

const SCAN_ROOTS: { root: string; depth: number }[] = [
  { root: join(HOME, "workspace"), depth: 3 },
  { root: join(HOME, "Desktop"), depth: 2 },
];

const EXCLUDE_NAMES = new Set([
  "node_modules", ".git", "dist", "build", ".next", "out", "coverage",
  ".cache", ".turbo", ".vite", "_archive",
]);

function isExcluded(name: string): boolean {
  if (EXCLUDE_NAMES.has(name)) return true;
  if (name.startsWith("_archive-") || name.startsWith(".")) return true;
  return false;
}

async function dirExists(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function hasClaudeSkillDirs(root: string): Promise<boolean> {
  const candidates = [
    join(root, ".claude/skills"),
    join(root, ".claude/commands/experts"),
  ];
  for (const c of candidates) {
    if (await dirExists(c)) return true;
  }
  return false;
}

async function scanForProjects(root: string, depth: number): Promise<string[]> {
  if (!(await dirExists(root))) return [];
  const found: string[] = [];

  async function walk(dir: string, remaining: number): Promise<void> {
    if (await hasClaudeSkillDirs(dir)) found.push(dir);
    if (remaining <= 0) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    await Promise.all(
      entries
        .filter((e) => e.isDirectory() && !isExcluded(e.name))
        .map((e) => walk(join(dir, e.name), remaining - 1)),
    );
  }

  await walk(root, depth);
  return found;
}

export async function discoverProjects(): Promise<ProjectInfo[]> {
  const all = await Promise.all(SCAN_ROOTS.map((s) => scanForProjects(s.root, s.depth)));
  const roots = Array.from(new Set(all.flat())).sort();
  return roots.map((root) => ({
    name: basename(root),
    root,
    pinned: false,
    discovered: true,
  }));
}

async function readConfigFile(): Promise<ProjectsConfig> {
  try {
    const txt = await readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(txt) as unknown;
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as ProjectsConfig).projects)) {
      const projects = (parsed as ProjectsConfig).projects.filter(
        (p): p is ProjectInfo =>
          typeof p === "object" && p !== null &&
          typeof p.name === "string" && typeof p.root === "string",
      );
      return { projects };
    }
  } catch {
    // missing file or bad json — treat as empty
  }
  return { projects: [] };
}

async function writeConfigFile(cfg: ProjectsConfig): Promise<void> {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  const tmp = `${CONFIG_PATH}.tmp.${process.pid}`;
  await writeFile(tmp, JSON.stringify(cfg, null, 2), "utf8");
  await rename(tmp, CONFIG_PATH);
}

function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

function mergeDiscovered(saved: ProjectInfo[], discovered: ProjectInfo[]): ProjectInfo[] {
  const byRoot = new Map(saved.map((p) => [p.root, p]));
  // Refresh discovered entries in saved
  for (const d of discovered) {
    const existing = byRoot.get(d.root);
    if (existing) {
      existing.discovered = true;
    } else {
      byRoot.set(d.root, d);
    }
  }
  // Drop entries that are non-pinned, were discovered, but no longer auto-found
  const discoveredRoots = new Set(discovered.map((d) => d.root));
  for (const p of [...byRoot.values()]) {
    if (!p.pinned && p.discovered && !discoveredRoots.has(p.root)) {
      byRoot.delete(p.root);
    }
  }
  // Resolve name conflicts
  const taken = new Set<string>();
  const out: ProjectInfo[] = [];
  for (const p of byRoot.values()) {
    const name = uniqueName(basename(p.root), taken);
    taken.add(name);
    out.push({ ...p, name });
  }
  out.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

let cache: { mtimeMs: number; projects: ProjectInfo[] } | null = null;
const CACHE_TTL_MS = 30_000;

function projectsEqual(a: ProjectInfo[], b: ProjectInfo[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (!x || !y) return false;
    if (x.root !== y.root || x.name !== y.name || x.pinned !== y.pinned || x.discovered !== y.discovered) return false;
  }
  return true;
}

export async function loadProjects(): Promise<ProjectInfo[]> {
  const now = Date.now();
  if (cache && now - cache.mtimeMs < CACHE_TTL_MS) return cache.projects;
  const [saved, discovered] = await Promise.all([readConfigFile(), discoverProjects()]);
  const merged = mergeDiscovered(saved.projects, discovered);
  if (!projectsEqual(saved.projects, merged)) {
    await writeConfigFile({ projects: merged });
  }
  cache = { mtimeMs: now, projects: merged };
  return merged;
}

function invalidateCache(): void {
  cache = null;
}

export async function addProject(rootInput: string, pin = false): Promise<ProjectInfo> {
  const root = resolve(rootInput);
  if (!(await dirExists(root))) throw new Error(`not a directory: ${root}`);
  if (!(await hasClaudeSkillDirs(root))) {
    throw new Error(`no .claude/skills or .claude/commands/experts under: ${root}`);
  }
  const cfg = await readConfigFile();
  if (cfg.projects.some((p) => p.root === root)) {
    const existing = cfg.projects.find((p) => p.root === root);
    if (existing && pin && !existing.pinned) {
      existing.pinned = true;
      await writeConfigFile(cfg);
    }
    if (!existing) throw new Error("internal: project lookup mismatch");
    return existing;
  }
  const taken = new Set(cfg.projects.map((p) => p.name));
  const project: ProjectInfo = {
    name: uniqueName(basename(root), taken),
    root,
    pinned: pin,
    discovered: false,
  };
  cfg.projects.push(project);
  await writeConfigFile(cfg);
  invalidateCache();
  return project;
}

export async function removeProject(name: string): Promise<boolean> {
  const cfg = await readConfigFile();
  const before = cfg.projects.length;
  cfg.projects = cfg.projects.filter((p) => p.name !== name);
  if (cfg.projects.length === before) return false;
  await writeConfigFile(cfg);
  invalidateCache();
  return true;
}

export async function setPin(name: string, pin: boolean): Promise<ProjectInfo | null> {
  const cfg = await readConfigFile();
  const p = cfg.projects.find((x) => x.name === name);
  if (!p) return null;
  p.pinned = pin;
  await writeConfigFile(cfg);
  invalidateCache();
  return p;
}

export const CONFIG_FILE_PATH = CONFIG_PATH;
