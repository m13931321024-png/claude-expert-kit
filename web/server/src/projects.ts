import { readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import type { ProjectInfo } from "../../shared/types.js";

const HOME = homedir();

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
  const candidates = [join(root, ".claude/skills"), join(root, ".claude/commands/experts")];
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

function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const c = `${base}-${i}`;
    if (!taken.has(c)) return c;
  }
  return `${base}-${Date.now()}`;
}

export async function loadProjects(): Promise<ProjectInfo[]> {
  const all = await Promise.all(SCAN_ROOTS.map((s) => scanForProjects(s.root, s.depth)));
  const roots = Array.from(new Set(all.flat())).sort();
  const taken = new Set<string>();
  return roots.map((root) => {
    const name = uniqueName(basename(root), taken);
    taken.add(name);
    return { name, root };
  });
}
