import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { loadAllSkills, toListItem } from "./skills.js";
import {
  loadProjects,
  addProject,
  removeProject,
  setPin,
  CONFIG_FILE_PATH,
} from "./projects.js";
import type { ApiError, ProjectInfo, SkillSource } from "../../shared/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const HOME_DIR = homedir();
const PORT = Number(process.env.PORT ?? 24210);
const HOST = "127.0.0.1";
const MAX_BODY_BYTES = 64 * 1024;

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

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return await new Promise((resolveBody, rejectBody) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejectBody(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (text.trim().length === 0) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(text));
      } catch {
        rejectBody(new Error("invalid JSON"));
      }
    });
    req.on("error", rejectBody);
  });
}

function getString(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === "object" && key in obj) {
    const v = (obj as Record<string, unknown>)[key];
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

function getBool(obj: unknown, key: string): boolean | undefined {
  if (obj && typeof obj === "object" && key in obj) {
    const v = (obj as Record<string, unknown>)[key];
    return typeof v === "boolean" ? v : undefined;
  }
  return undefined;
}

const ALLOWED_HOSTNAMES = ["127.0.0.1", "localhost", "[::1]"];

function isAllowedHost(host: string): boolean {
  return ALLOWED_HOSTNAMES.some((h) => host === h || host.startsWith(`${h}:`));
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const host = req.headers.host ?? "";
  if (!isAllowedHost(host)) {
    sendErr(res, 403, "forbidden_host", "use 127.0.0.1 or localhost");
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? HOST}`);
  const { pathname } = url;
  const method = req.method ?? "GET";

  if (method === "GET" && pathname === "/api/health") {
    const projects = await loadProjects();
    send(res, 200, {
      ok: true,
      version: "0.1.0",
      repoRoot: REPO_ROOT,
      cwd: REPO_ROOT,
      homeDir: HOME_DIR,
      projectName: "claude-expert-kit",
      projectCount: projects.length,
      configPath: CONFIG_FILE_PATH,
    });
    return;
  }

  if (method === "GET" && pathname === "/api/skills") {
    const projects = await loadProjects();
    const all = await loadAllSkills(buildSources(projects));
    send(res, 200, all.map(toListItem));
    return;
  }

  if (method === "GET" && pathname === "/api/projects") {
    const projects = await loadProjects();
    const all = await loadAllSkills(buildSources(projects));
    const counts = new Map<string, number>();
    for (const s of all) {
      if (s.scope === "project" && s.projectName) {
        counts.set(s.projectName, (counts.get(s.projectName) ?? 0) + 1);
      }
    }
    send(res, 200, projects.map((p) => ({ ...p, skillCount: counts.get(p.name) ?? 0 })));
    return;
  }

  if (method === "POST" && pathname === "/api/projects") {
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (e) {
      sendErr(res, 400, "bad_body", e instanceof Error ? e.message : String(e));
      return;
    }
    const root = getString(body, "root");
    if (!root) {
      sendErr(res, 400, "missing_field", "body.root required");
      return;
    }
    const pin = getBool(body, "pin") ?? false;
    try {
      const p = await addProject(root, pin);
      send(res, 201, p);
    } catch (e) {
      sendErr(res, 400, "add_failed", e instanceof Error ? e.message : String(e));
    }
    return;
  }

  const projectByName = /^\/api\/projects\/(.+)$/.exec(pathname);
  if (projectByName) {
    let name: string;
    try {
      name = decodeURIComponent(projectByName[1] ?? "");
    } catch {
      sendErr(res, 400, "bad_uri");
      return;
    }
    if (method === "DELETE") {
      const ok = await removeProject(name);
      if (!ok) {
        sendErr(res, 404, "not_found", `project: ${name}`);
        return;
      }
      send(res, 200, { ok: true });
      return;
    }
    if (method === "PATCH") {
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        sendErr(res, 400, "bad_body", e instanceof Error ? e.message : String(e));
        return;
      }
      const pin = getBool(body, "pin");
      if (pin === undefined) {
        sendErr(res, 400, "missing_field", "body.pin required");
        return;
      }
      const updated = await setPin(name, pin);
      if (!updated) {
        sendErr(res, 404, "not_found", `project: ${name}`);
        return;
      }
      send(res, 200, updated);
      return;
    }
  }

  if (method === "GET") {
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
      const projects = await loadProjects();
      const all = await loadAllSkills(buildSources(projects));
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
  }

  sendErr(res, 404, "not_found", pathname);
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
  console.log(`[skillctl-web sidecar] repo root:    ${REPO_ROOT}`);
  console.log(`[skillctl-web sidecar] config file:  ${CONFIG_FILE_PATH}`);
});
