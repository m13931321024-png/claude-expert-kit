import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearParseCache,
  createSkill,
  deleteSkill,
  fetchSkillFromGitHub,
  importSkillToDisk,
  loadAllSkills,
  resolveSkillDir,
  serializeSkillFile,
  updateSkill,
  validateSkillName,
} from "./skills.js";
import type { SkillCreateRequest, SkillDetail } from "../../shared/types.js";

const fmFenceRe = /^---\n([\s\S]*?)\n---\n/;

let TMP_ROOT: string;
let GLOBAL_ROOT: string;
let TRASH_ROOT: string;
let PROJECT_ROOT: string;

beforeAll(async () => {
  TMP_ROOT = await mkdtemp(join(tmpdir(), "cek-test-"));
  GLOBAL_ROOT = join(TMP_ROOT, "claude-skills");
  TRASH_ROOT = join(TMP_ROOT, "trash");
  PROJECT_ROOT = join(TMP_ROOT, "proj");
  await mkdir(GLOBAL_ROOT, { recursive: true });
  await mkdir(join(PROJECT_ROOT, ".claude/skills"), { recursive: true });
  process.env.CEK_GLOBAL_SKILL_ROOT = GLOBAL_ROOT;
  process.env.CEK_TRASH_ROOT = TRASH_ROOT;
});

beforeEach(() => {
  clearParseCache();
});

// ============ pure function tests ============

describe("validateSkillName", () => {
  it("accepts lowercase alphanumeric, dash, underscore", () => {
    expect(validateSkillName("skill")).toBe(null);
    expect(validateSkillName("my-skill")).toBe(null);
    expect(validateSkillName("my_skill_2")).toBe(null);
    expect(validateSkillName("a")).toBe(null);
    expect(validateSkillName("0abc")).toBe(null);
  });

  it("rejects path traversal", () => {
    expect(validateSkillName("../evil")).not.toBe(null);
    expect(validateSkillName("../")).not.toBe(null);
    expect(validateSkillName("evil/path")).not.toBe(null);
  });

  it("rejects leading dash/underscore", () => {
    expect(validateSkillName("-skill")).not.toBe(null);
    expect(validateSkillName("_skill")).not.toBe(null);
  });

  it("rejects uppercase", () => {
    expect(validateSkillName("Skill")).not.toBe(null);
    expect(validateSkillName("SKILL")).not.toBe(null);
  });

  it("rejects empty / too long / unicode / special", () => {
    expect(validateSkillName("")).not.toBe(null);
    expect(validateSkillName("a".repeat(81))).not.toBe(null);
    expect(validateSkillName("中文")).not.toBe(null);
    expect(validateSkillName("name with space")).not.toBe(null);
    expect(validateSkillName("name.dot")).not.toBe(null);
  });
});

describe("resolveSkillDir", () => {
  it("global scope writes to env-overridden GLOBAL_SKILL_ROOT", () => {
    const { dir, file } = resolveSkillDir("foo", "global");
    expect(dir).toBe(join(GLOBAL_ROOT, "foo"));
    expect(file).toBe(join(GLOBAL_ROOT, "foo", "SKILL.md"));
  });

  it("project scope writes under projectRoot/.claude/skills", () => {
    const { dir, file } = resolveSkillDir("bar", "project", PROJECT_ROOT);
    expect(dir).toBe(join(PROJECT_ROOT, ".claude/skills", "bar"));
    expect(file).toContain("SKILL.md");
  });

  it("project scope without projectRoot throws", () => {
    expect(() => resolveSkillDir("foo", "project")).toThrow(/project scope/);
  });
});

describe("serializeSkillFile (round-trip)", () => {
  it("preserves all extra frontmatter fields", () => {
    const meta = {
      name: "my-skill",
      type: "expert",
      description: "x",
      priority: "high",
      calls: ["a", "b"],
      keywords: ["foo", "bar"],
      version: "0.3.0",
      platforms: ["claude-code"],
      maintainer: "me",
    };
    const out = serializeSkillFile(meta, "# body");
    const m = fmFenceRe.exec(out);
    expect(m).not.toBeNull();
    // re-parse with js-yaml via importing parser (use round-trip via raw)
    const yamlBlock = m![1]!;
    expect(yamlBlock).toContain("priority: high");
    expect(yamlBlock).toContain("version: 0.3.0");
    expect(yamlBlock).toContain("maintainer: me");
    expect(yamlBlock).toContain("platforms: [claude-code]");
  });

  it("emits arrays in flow style (flowLevel:1)", () => {
    const out = serializeSkillFile({ name: "x", keywords: ["a", "b"] }, "");
    expect(out).toMatch(/keywords: \[a, b\]/);
  });

  it("escapes special characters in values", () => {
    const out = serializeSkillFile({ name: "x", description: "has: colon" }, "");
    // js-yaml auto-quotes when value contains ': '
    expect(out).toMatch(/description: ['"]has: colon['"]/);
  });

  it("handles multi-line description (quoted or block — round-trip preserves value)", async () => {
    const yaml = (await import("js-yaml")).default;
    const original = "line1\nline2\n---inside---";
    const out = serializeSkillFile({ name: "x", description: original }, "");
    const m = fmFenceRe.exec(out);
    expect(m).not.toBeNull();
    const parsed = yaml.load(m![1]!) as { description: string };
    expect(parsed.description).toBe(original);
  });
});

// ============ CRUD integration tests ============

async function uniqueRoot(): Promise<string> {
  return await mkdtemp(join(TMP_ROOT, "case-"));
}

describe("createSkill", () => {
  let root: string;
  beforeEach(async () => {
    root = await uniqueRoot();
  });

  it("creates a project-scope skill with full meta", async () => {
    await mkdir(join(root, ".claude/skills"), { recursive: true });
    const req: SkillCreateRequest = {
      name: "test-skill",
      scope: "project",
      type: "tool",
      description: "first",
      keywords: ["a"],
      body: "# Body",
    };
    const result = await createSkill(req, root);
    expect(result.name).toBe("test-skill");
    expect(result.path).toBe(join(root, ".claude/skills/test-skill/SKILL.md"));
    const content = await readFile(result.path, "utf8");
    expect(content).toContain("name: test-skill");
    expect(content).toContain("type: tool");
    expect(content).toContain("# Body");
  });

  it("rejects path-traversal name", async () => {
    await mkdir(join(root, ".claude/skills"), { recursive: true });
    await expect(
      createSkill({ name: "../evil", scope: "project", type: "tool", description: "x", keywords: [], body: "y" }, root),
    ).rejects.toThrow(/bad_name/);
  });

  it("rejects duplicate via wx flag (already_exists)", async () => {
    await mkdir(join(root, ".claude/skills"), { recursive: true });
    const req: SkillCreateRequest = {
      name: "dup",
      scope: "project",
      type: "tool",
      description: "x",
      keywords: [],
      body: "y",
    };
    await createSkill(req, root);
    await expect(createSkill(req, root)).rejects.toThrow("already_exists");
  });

  it("concurrent createSkill same name → exactly one wins", async () => {
    await mkdir(join(root, ".claude/skills"), { recursive: true });
    const req: SkillCreateRequest = {
      name: "race",
      scope: "project",
      type: "tool",
      description: "x",
      keywords: [],
      body: "y",
    };
    const results = await Promise.allSettled([createSkill(req, root), createSkill(req, root)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toBe("already_exists");
  });
});

async function loadAsDetail(path: string): Promise<SkillDetail> {
  const skills = await loadAllSkills(
    [{ scope: "project", projectName: "p", dirs: [join(path, ".claude/skills")], defaultType: "tool" }],
    [join(path, ".claude/skills")],
  );
  expect(skills).toHaveLength(1);
  return skills[0]!;
}

describe("updateSkill (preserve extra fields)", () => {
  let root: string;
  beforeEach(async () => {
    root = await uniqueRoot();
    await mkdir(join(root, ".claude/skills"), { recursive: true });
  });

  it("preserves frontmatter fields not in the request", async () => {
    // Manually write a skill with priority + calls + maintainer
    const skillFile = join(root, ".claude/skills/foo/SKILL.md");
    await mkdir(join(root, ".claude/skills/foo"), { recursive: true });
    await writeFile(
      skillFile,
      `---\nname: foo\ntype: expert\ndescription: orig\npriority: high\ncalls: [x:y]\nkeywords: [a]\nmaintainer: alice\n---\n\n# Body\n`,
      "utf8",
    );
    const detail = await loadAsDetail(root);
    expect(detail.name).toBe("foo");
    await updateSkill(detail, { description: "patched" }, [join(root, ".claude/skills")]);
    const content = await readFile(skillFile, "utf8");
    expect(content).toContain("description: patched");
    expect(content).toContain("priority: high"); // preserved
    expect(content).toContain("maintainer: alice"); // preserved
    expect(content).toMatch(/calls: \[x:y\]/); // preserved
  });

  it("returns not_found if file is gone (concurrent DELETE race)", async () => {
    const skillFile = join(root, ".claude/skills/ghost/SKILL.md");
    await mkdir(join(root, ".claude/skills/ghost"), { recursive: true });
    await writeFile(skillFile, `---\nname: ghost\ntype: tool\ndescription: x\nkeywords: []\n---\n\nbody\n`, "utf8");
    const detail = await loadAsDetail(root);
    // simulate DELETE moved file away
    await rm(skillFile);
    await expect(updateSkill(detail, { description: "y" }, [join(root, ".claude/skills")])).rejects.toThrow(
      "not_found",
    );
  });

  it("rejects example-scope skills (read-only)", async () => {
    const detail = {
      name: "x",
      scope: "example" as const,
      type: "tool" as const,
      path: "/somewhere/x.md",
      description: "",
      keywords: [],
      writable: false,
      priority: "medium" as const,
      chain: [],
      calls: [],
      version: "",
      platforms: [],
      maintainer: "",
      body: "",
      raw: "---\nname: x\n---\n\n",
    };
    await expect(updateSkill(detail, { description: "y" }, ["/somewhere"])).rejects.toThrow("not_writable_scope");
  });
});

describe("deleteSkill (trash + EXDEV fallback)", () => {
  let root: string;
  beforeEach(async () => {
    root = await uniqueRoot();
    await mkdir(join(root, ".claude/skills"), { recursive: true });
  });

  it("nested skill: moves entire dir to trash", async () => {
    const skillFile = join(root, ".claude/skills/nest/SKILL.md");
    await mkdir(join(root, ".claude/skills/nest"), { recursive: true });
    await writeFile(skillFile, `---\nname: nest\ntype: tool\ndescription: x\nkeywords: []\n---\n\nbody\n`, "utf8");
    const detail = await loadAsDetail(root);
    const result = await deleteSkill(detail, [join(root, ".claude/skills")]);
    expect(result.trashedTo).toContain(TRASH_ROOT);
    expect(result.trashedTo).toContain("project__p__nest");
    // original gone
    await expect(stat(skillFile)).rejects.toThrow();
    // trash exists
    await expect(stat(result.trashedTo)).resolves.toBeDefined();
  });

  it("trash stamps unique within same second (no collision)", async () => {
    // create 3 skills, delete all rapidly
    for (const n of ["a1", "a2", "a3"]) {
      await mkdir(join(root, ".claude/skills", n), { recursive: true });
      await writeFile(
        join(root, ".claude/skills", n, "SKILL.md"),
        `---\nname: ${n}\ntype: tool\ndescription: x\nkeywords: []\n---\n\nbody\n`,
        "utf8",
      );
    }
    const skills = await loadAllSkills(
      [{ scope: "project", projectName: "p", dirs: [join(root, ".claude/skills")], defaultType: "tool" }],
      [join(root, ".claude/skills")],
    );
    const trashed = await Promise.all(skills.map((s) => deleteSkill(s, [join(root, ".claude/skills")])));
    const dests = new Set(trashed.map((r) => r.trashedTo));
    expect(dests.size).toBe(3); // all unique
  });

  it("rejects non-writable path", async () => {
    // skill outside the allowed roots
    const detail = {
      name: "x",
      scope: "global" as const,
      type: "tool" as const,
      path: "/etc/passwd",
      description: "",
      keywords: [],
      writable: false,
      priority: "medium" as const,
      chain: [],
      calls: [],
      version: "",
      platforms: [],
      maintainer: "",
      body: "",
      raw: "",
    };
    await expect(deleteSkill(detail, [GLOBAL_ROOT])).rejects.toThrow("not_writable");
  });
});

// ============ importSkillToDisk preserves rawMeta ============

describe("importSkillToDisk", () => {
  let root: string;
  beforeEach(async () => {
    root = await uniqueRoot();
    await mkdir(join(root, ".claude/skills"), { recursive: true });
  });

  it("preserves all 9 frontmatter fields from fetched.rawMeta", async () => {
    const fetched = {
      name: "imported",
      type: "expert" as const,
      description: "from github",
      keywords: ["a"],
      body: "# body",
      finalUrl: "https://raw.githubusercontent.com/x/y/main/foo.md",
      rawMeta: {
        name: "imported",
        type: "expert",
        description: "from github",
        priority: "high",
        calls: ["call:x"],
        keywords: ["a"],
        version: "0.3.0",
        platforms: ["claude-code"],
        maintainer: "alice",
      },
    };
    const result = await importSkillToDisk(fetched, "project", root, "p", undefined);
    const content = await readFile(result.path, "utf8");
    expect(content).toContain("priority: high");
    expect(content).toContain("calls: [call:x]");
    expect(content).toContain("version: 0.3.0");
    expect(content).toContain("platforms: [claude-code]");
    expect(content).toContain("maintainer: alice");
  });

  it("nameOverride patches name field, keeps rest of rawMeta", async () => {
    const fetched = {
      name: "original-name",
      type: "tool" as const,
      description: "x",
      keywords: [],
      body: "y",
      finalUrl: "https://raw.githubusercontent.com/x/y/main/foo.md",
      rawMeta: {
        name: "original-name",
        type: "tool",
        description: "x",
        priority: "low",
        keywords: [],
      },
    };
    const result = await importSkillToDisk(fetched, "project", root, "p", "renamed");
    expect(result.name).toBe("renamed");
    const content = await readFile(result.path, "utf8");
    expect(content).toContain("name: renamed");
    expect(content).toContain("priority: low"); // preserved
    expect(content).not.toContain("name: original-name");
  });
});

// ============ fetchSkillFromGitHub (mock fetch) ============

describe("fetchSkillFromGitHub (mocked)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockResponse(body: string, headers: Record<string, string> = {}): Response {
    return new Response(body, { status: 200, headers });
  }

  function mockRedirect(location: string, status = 302): Response {
    return new Response("", { status, headers: { location } });
  }

  it("rejects non-https protocol", async () => {
    await expect(fetchSkillFromGitHub("http://github.com/x/y/main/foo.md")).rejects.toThrow(/bad_url/);
  });

  it("rejects bad host", async () => {
    await expect(fetchSkillFromGitHub("https://evil.com/foo.md")).rejects.toThrow(/bad_host/);
  });

  it("rejects malformed URL", async () => {
    await expect(fetchSkillFromGitHub("not-a-url")).rejects.toThrow();
  });

  it("auto-rewrites blob URL to raw before fetch", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      mockResponse(`---\nname: foo\ntype: tool\ndescription: x\nkeywords: []\n---\n\nbody\n`),
    );
    await fetchSkillFromGitHub("https://github.com/owner/repo/blob/main/foo.md");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0]![0]! as string;
    expect(calledUrl).toContain("raw.githubusercontent.com");
    expect(calledUrl).toContain("/owner/repo/main/foo.md");
  });

  it("follows up to 3 redirects, validating host each hop", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(mockRedirect("https://raw.githubusercontent.com/a/b/main/x.md"))
      .mockResolvedValueOnce(mockRedirect("https://github.com/c/d/blob/main/y.md"))
      .mockResolvedValueOnce(
        mockResponse(`---\nname: ok\ntype: tool\ndescription: x\nkeywords: []\n---\n\nbody\n`),
      );
    const result = await fetchSkillFromGitHub("https://raw.githubusercontent.com/x/y/main/start.md");
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result.name).toBe("ok");
  });

  it("throws on too many redirects (>3)", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockRedirect("https://raw.githubusercontent.com/a/b/main/1.md"))
      .mockResolvedValueOnce(mockRedirect("https://raw.githubusercontent.com/a/b/main/2.md"))
      .mockResolvedValueOnce(mockRedirect("https://raw.githubusercontent.com/a/b/main/3.md"))
      .mockResolvedValueOnce(mockRedirect("https://raw.githubusercontent.com/a/b/main/4.md"));
    await expect(fetchSkillFromGitHub("https://raw.githubusercontent.com/x/y/main/start.md")).rejects.toThrow(
      "too_many_redirects",
    );
  });

  it("rejects redirect to non-allowlisted host", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockRedirect("https://evil.com/foo.md"));
    await expect(fetchSkillFromGitHub("https://raw.githubusercontent.com/x/y/main/start.md")).rejects.toThrow(
      /bad_host/,
    );
  });

  it("rejects when Content-Length exceeds 64KB", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response("x", { status: 200, headers: { "content-length": String(65 * 1024) } }),
    );
    await expect(fetchSkillFromGitHub("https://raw.githubusercontent.com/x/y/main/big.md")).rejects.toThrow(
      "body_too_large",
    );
  });

  it("rejects body exceeding 64KB even without Content-Length", async () => {
    const huge = "x".repeat(65 * 1024);
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(huge, { status: 200 }));
    await expect(fetchSkillFromGitHub("https://raw.githubusercontent.com/x/y/main/big.md")).rejects.toThrow(
      "body_too_large",
    );
  });

  it("rejects content without frontmatter", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockResponse("just a markdown without fence"));
    await expect(fetchSkillFromGitHub("https://raw.githubusercontent.com/x/y/main/none.md")).rejects.toThrow(
      /not_a_skill/,
    );
  });

  it("rejects frontmatter missing name", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockResponse(`---\ntype: tool\n---\n\nbody\n`));
    await expect(fetchSkillFromGitHub("https://raw.githubusercontent.com/x/y/main/x.md")).rejects.toThrow(
      /not_a_skill/,
    );
  });

  it("rejects HTTP error status", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("", { status: 404 }));
    await expect(fetchSkillFromGitHub("https://raw.githubusercontent.com/x/y/main/x.md")).rejects.toThrow(
      /HTTP 404/,
    );
  });

  it("returns rawMeta with all original fields", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      mockResponse(
        `---\nname: full\ntype: expert\ndescription: d\npriority: high\ncalls: [x]\nkeywords: [k]\nversion: 1.0\nplatforms: [claude-code]\nmaintainer: me\n---\n\nbody\n`,
      ),
    );
    const result = await fetchSkillFromGitHub("https://raw.githubusercontent.com/x/y/main/full.md");
    expect(result.name).toBe("full");
    expect(result.rawMeta.priority).toBe("high");
    expect(result.rawMeta.maintainer).toBe("me");
    expect(result.rawMeta.version).toBe(1); // YAML parses "1.0" as number; semantic OK
  });
});
