import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import {
  createSkill,
  deleteSkill,
  fetchSkillFromGitHub,
  importSkillToDisk,
  loadAllSkills,
  toListItem,
  updateSkill,
  validateSkillName,
} from "./skills.js";
import { loadProjects } from "./projects.js";
import type {
  ApiError,
  ProjectInfo,
  SkillCreateRequest,
  SkillSource,
  SkillType,
  SkillUpdateRequest,
  WritableScope,
} from "../../shared/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const HOME_DIR = homedir();
const PORT = Number(process.env.PORT ?? 24210);
const HOST = "127.0.0.1";

function buildSources(projects: ProjectInfo[]): SkillSource[] {
  const sources: SkillSource[] = [
    {
      scope: "global",
      dirs: [
        join(HOME_DIR, ".claude/commands/experts"),
        join(HOME_DIR, ".claude/commands/_legacy"),
        join(HOME_DIR, ".claude/skills"),
      ],
      defaultType: "expert",
    },
  ];
  for (const p of projects) {
    sources.push({
      scope: "project",
      projectName: p.name,
      dirs: [join(p.root, ".claude/skills"), join(p.root, ".claude/commands/experts")],
      defaultType: "expert",
    });
  }
  sources.push({
    scope: "example",
    dirs: [
      join(REPO_ROOT, "examples/canonical-skills/experts"),
      join(REPO_ROOT, "examples/canonical-skills/_internal"),
    ],
    defaultType: "expert",
  });
  return sources;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function sendText(res: ServerResponse, status: number, body: string, type = "text/plain; charset=utf-8"): void {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function sendErr(res: ServerResponse, status: number, error: string, detail?: string): void {
  const err: ApiError = detail !== undefined ? { error, detail } : { error };
  send(res, status, err);
}

const ALLOWED_HOSTNAMES = ["127.0.0.1", "localhost", "[::1]"];
const MAX_BODY_BYTES = 64 * 1024;

function isAllowedHost(host: string): boolean {
  return ALLOWED_HOSTNAMES.some((h) => host === h || host.startsWith(`${h}:`));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = chunk instanceof Buffer ? chunk : Buffer.from(chunk as string);
    total += buf.length;
    if (total > MAX_BODY_BYTES) throw new Error("body_too_large");
    chunks.push(buf);
  }
  if (total === 0) return null;
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("invalid_json");
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function getStringArray(obj: Record<string, unknown>, key: string): string[] | undefined {
  const v = obj[key];
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is string => typeof x === "string");
}

function getScope(obj: Record<string, unknown>, key: string): WritableScope | undefined {
  const v = obj[key];
  return v === "global" || v === "project" ? v : undefined;
}

function getType(obj: Record<string, unknown>, key: string): SkillType | undefined {
  const v = obj[key];
  return v === "expert" || v === "internal" || v === "tool" ? v : undefined;
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const host = req.headers.host ?? "";
  if (!isAllowedHost(host)) {
    sendErr(res, 403, "forbidden_host", "use 127.0.0.1 or localhost");
    return;
  }

  const method = req.method ?? "GET";
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) {
    sendErr(res, 405, "method_not_allowed");
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? HOST}`);
  const { pathname } = url;

  if (pathname === "/api/health") {
    const projects = await loadProjects();
    send(res, 200, {
      ok: true,
      version: "0.1.0",
      repoRoot: REPO_ROOT,
      cwd: REPO_ROOT,
      homeDir: HOME_DIR,
      projectName: "claude-expert-kit",
      projectCount: projects.length,
    });
    return;
  }

  if (pathname === "/api/projects") {
    if (method !== "GET") {
      sendErr(res, 405, "method_not_allowed");
      return;
    }
    const projects = await loadProjects();
    send(res, 200, projects);
    return;
  }

  if (pathname === "/api/skills") {
    if (method === "GET") {
      const projects = await loadProjects();
      const all = await loadAllSkills(buildSources(projects), buildAllowedRoots(projects));
      send(res, 200, all.map(toListItem));
      return;
    }
    if (method === "POST") {
      await handleCreateSkill(req, res);
      return;
    }
    sendErr(res, 405, "method_not_allowed");
    return;
  }

  if (pathname === "/api/skills/import") {
    if (method !== "POST") {
      sendErr(res, 405, "method_not_allowed");
      return;
    }
    await handleImportSkill(req, res);
    return;
  }

  const detailMatch = /^\/api\/skills\/(.+?)(\/raw)?$/.exec(pathname);
  if (detailMatch) {
    let name: string;
    try {
      name = decodeURIComponent(detailMatch[1] ?? "");
    } catch {
      sendErr(res, 400, "bad_uri");
      return;
    }
    const wantRaw = detailMatch[2] === "/raw";
    if (method === "GET") {
      const projects = await loadProjects();
      const all = await loadAllSkills(buildSources(projects), buildAllowedRoots(projects));
      const found = all.find((s) => s.name === name);
      if (!found) {
        sendErr(res, 404, "not_found", `skill: ${name}`);
        return;
      }
      if (wantRaw) {
        sendText(res, 200, found.raw, "text/markdown; charset=utf-8");
        return;
      }
      send(res, 200, found);
      return;
    }
    if (wantRaw) {
      sendErr(res, 405, "method_not_allowed");
      return;
    }
    if (method === "PATCH") {
      await handleUpdateSkill(req, res, name);
      return;
    }
    if (method === "DELETE") {
      await handleDeleteSkill(res, name);
      return;
    }
    sendErr(res, 405, "method_not_allowed");
    return;
  }

  sendErr(res, 404, "not_found", pathname);
}

function buildAllowedRoots(projects: ProjectInfo[]): string[] {
  const roots = [join(HOME_DIR, ".claude/skills")];
  for (const p of projects) roots.push(join(p.root, ".claude/skills"));
  return roots;
}

async function handleCreateSkill(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (e: unknown) {
    sendErr(res, 400, e instanceof Error ? e.message : "bad_body");
    return;
  }
  if (!isObj(body)) {
    sendErr(res, 400, "bad_body", "expected object");
    return;
  }
  const name = getString(body, "name") ?? "";
  const nameErr = validateSkillName(name);
  if (nameErr !== null) {
    sendErr(res, 400, "bad_name", nameErr);
    return;
  }
  const scope = getScope(body, "scope");
  if (scope === undefined) {
    sendErr(res, 400, "bad_scope", "scope must be 'global' or 'project'");
    return;
  }
  const type = getType(body, "type") ?? "tool";
  const description = getString(body, "description") ?? "";
  const keywords = getStringArray(body, "keywords") ?? [];
  const skillBody = getString(body, "body") ?? "";
  const projectName = getString(body, "projectName");

  let projectRoot: string | undefined;
  let resolvedProjectName: string | undefined;
  if (scope === "project") {
    if (projectName === undefined || projectName === "") {
      sendErr(res, 400, "missing_project_name");
      return;
    }
    const projects = await loadProjects();
    const proj = projects.find((p) => p.name === projectName);
    if (!proj) {
      sendErr(res, 404, "project_not_found", projectName);
      return;
    }
    projectRoot = proj.root;
    resolvedProjectName = proj.name;
  }

  const createReq: SkillCreateRequest = {
    name,
    scope,
    type,
    description,
    keywords,
    body: skillBody,
  };
  if (resolvedProjectName !== undefined) createReq.projectName = resolvedProjectName;

  try {
    const result = await createSkill(createReq, projectRoot);
    send(res, 201, result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "create_failed";
    if (msg === "already_exists") {
      sendErr(res, 409, "already_exists", name);
    } else {
      sendErr(res, 400, "create_failed", msg);
    }
  }
}

async function handleUpdateSkill(
  req: IncomingMessage,
  res: ServerResponse,
  name: string,
): Promise<void> {
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (e: unknown) {
    sendErr(res, 400, e instanceof Error ? e.message : "bad_body");
    return;
  }
  if (!isObj(body)) {
    sendErr(res, 400, "bad_body", "expected object");
    return;
  }
  const projects = await loadProjects();
  const allowedRoots = buildAllowedRoots(projects);
  const all = await loadAllSkills(buildSources(projects), allowedRoots);
  const existing = all.find((s) => s.name === name);
  if (!existing) {
    sendErr(res, 404, "not_found", `skill: ${name}`);
    return;
  }
  const updateReq: SkillUpdateRequest = {};
  const desc = getString(body, "description");
  if (desc !== undefined) updateReq.description = desc;
  const kw = getStringArray(body, "keywords");
  if (kw !== undefined) updateReq.keywords = kw;
  const ty = getType(body, "type");
  if (ty !== undefined) updateReq.type = ty;
  const bd = getString(body, "body");
  if (bd !== undefined) updateReq.body = bd;

  try {
    const result = await updateSkill(existing, updateReq, allowedRoots);
    send(res, 200, result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "update_failed";
    if (msg === "not_writable" || msg === "not_writable_scope") {
      sendErr(res, 403, msg, existing.path);
    } else {
      sendErr(res, 400, "update_failed", msg);
    }
  }
}

async function handleDeleteSkill(res: ServerResponse, name: string): Promise<void> {
  const projects = await loadProjects();
  const allowedRoots = buildAllowedRoots(projects);
  const all = await loadAllSkills(buildSources(projects), allowedRoots);
  const existing = all.find((s) => s.name === name);
  if (!existing) {
    sendErr(res, 404, "not_found", `skill: ${name}`);
    return;
  }
  try {
    const result = await deleteSkill(existing, allowedRoots);
    send(res, 200, result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "delete_failed";
    if (msg === "not_writable") {
      sendErr(res, 403, msg, existing.path);
    } else {
      sendErr(res, 400, "delete_failed", msg);
    }
  }
}

async function handleImportSkill(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (e: unknown) {
    sendErr(res, 400, e instanceof Error ? e.message : "bad_body");
    return;
  }
  if (!isObj(body)) {
    sendErr(res, 400, "bad_body", "expected object");
    return;
  }
  const url = getString(body, "url") ?? "";
  if (url === "") {
    sendErr(res, 400, "missing_url");
    return;
  }
  const scope = getScope(body, "scope");
  if (scope === undefined) {
    sendErr(res, 400, "bad_scope", "scope must be 'global' or 'project'");
    return;
  }
  const projectName = getString(body, "projectName");
  const nameOverride = getString(body, "nameOverride");

  let projectRoot: string | undefined;
  let resolvedProjectName: string | undefined;
  if (scope === "project") {
    if (projectName === undefined || projectName === "") {
      sendErr(res, 400, "missing_project_name");
      return;
    }
    const projects = await loadProjects();
    const proj = projects.find((p) => p.name === projectName);
    if (!proj) {
      sendErr(res, 404, "project_not_found", projectName);
      return;
    }
    projectRoot = proj.root;
    resolvedProjectName = proj.name;
  }

  let fetched;
  try {
    fetched = await fetchSkillFromGitHub(url);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    sendErr(res, 400, "fetch_failed", msg);
    return;
  }

  const finalName = nameOverride !== undefined && nameOverride !== "" ? nameOverride : fetched.name;
  const nameErr = validateSkillName(finalName);
  if (nameErr !== null) {
    sendErr(res, 400, "bad_name", `${nameErr} (after import: ${finalName})`);
    return;
  }

  try {
    const result = await importSkillToDisk(
      fetched,
      scope,
      projectRoot,
      resolvedProjectName,
      nameOverride,
    );
    send(res, 201, result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "import_failed";
    if (msg === "already_exists") {
      sendErr(res, 409, "already_exists", finalName);
    } else {
      sendErr(res, 400, "import_failed", msg);
    }
  }
}

const server = createServer((req, res) => {
  handle(req, res).catch((err: unknown) => {
    const detail = err instanceof Error ? err.message : String(err);
    sendErr(res, 500, "internal", detail);
  });
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[skillctl-web sidecar] port ${PORT} already in use`);
  } else {
    console.error(`[skillctl-web sidecar] listen failed:`, err.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`[skillctl-web sidecar] listening on http://${HOST}:${PORT}`);
  console.log(`[skillctl-web sidecar] repo root: ${REPO_ROOT}`);
});
