import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { executeRename, RenameError } from "@/lib/rename/execute";
import { createTempGitRepo, type TempGitRepo } from "./helpers/temp-git";
import { createTestDb, seedAsset, seedSource, type TestDb } from "./helpers/test-db";

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>';

let t: TestDb;
let repo: TempGitRepo;
let external: TempGitRepo;

beforeEach(() => {
  t = createTestDb();
  repo = createTempGitRepo();
  external = createTempGitRepo();
});

afterEach(() => {
  t.cleanup();
  repo.cleanup();
  external.cleanup();
});

type Setup = {
  db: Db;
  sourceId: number;
  asset: schema.Asset;
  inRootUsageId: number;
  externalUsageId: number;
};

function seedUsage(
  db: Db,
  assetId: number,
  sourceId: number,
  relPath: string,
  absPath: string,
  line: number,
  snippet: string,
): number {
  const [row] = db
    .insert(schema.usages)
    .values({ assetId, sourceId, relPath, absPath, line, snippet, commented: false })
    .returning()
    .all();
  if (!row) throw new Error("failed to seed usage");
  return row.id;
}

function setup(opts: { usageLine?: number } = {}): Setup {
  repo.write("icons/house.svg", SVG);
  repo.write("src/App.tsx", 'import icon from "../icons/house.svg";\nexport default icon;\n');
  repo.commit("seed repo");

  external.write("widgets/Widget.tsx", 'const url = "house.svg";\n');
  external.commit("seed external");

  const source = seedSource(t.db, repo.dir);
  const asset = seedAsset(t.db, source.id, {
    name: "house.svg",
    relPath: "icons/house.svg",
    dir: "icons",
    absPath: join(repo.dir, "icons/house.svg"),
  });
  const inRootUsageId = seedUsage(
    t.db,
    asset.id,
    source.id,
    "src/App.tsx",
    join(repo.dir, "src/App.tsx"),
    opts.usageLine ?? 1,
    'import icon from "../icons/house.svg";',
  );
  const externalUsageId = seedUsage(
    t.db,
    asset.id,
    source.id,
    join(external.dir, "widgets/Widget.tsx"),
    join(external.dir, "widgets/Widget.tsx"),
    1,
    'const url = "house.svg";',
  );
  return { db: t.db, sourceId: source.id, asset, inRootUsageId, externalUsageId };
}

function execInput(s: Setup, overrides: Record<string, unknown> = {}) {
  return {
    db: s.db,
    asset: s.asset,
    sourceRoot: repo.dir,
    sourceId: s.sourceId,
    newNameRaw: "home.svg",
    acceptedUsageIds: "all" as const,
    skipStale: false,
    ...overrides,
  };
}

describe("executeRename safety", () => {
  it("renames, edits in-root refs, commits, and never touches external files", async () => {
    const s = setup();
    const result = await executeRename(execInput(s));

    expect(readFileSync(join(repo.dir, "icons/home.svg"), "utf8")).toBe(SVG);
    expect(readFileSync(join(repo.dir, "src/App.tsx"), "utf8")).toContain("home.svg");
    expect(result.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(repo.git("log", "-1", "--format=%s")).toContain("rename:");
    expect(repo.git("status", "--porcelain")).toBe("");

    expect(readFileSync(join(external.dir, "widgets/Widget.tsx"), "utf8")).toBe(
      'const url = "house.svg";\n',
    );
    expect(result.skippedExternal).toHaveLength(1);
    expect(result.skippedExternal[0]?.usageId).toBe(s.externalUsageId);
    expect(result.indexStale).toBe(false);

    const row = t.db.select().from(schema.assets).where(eq(schema.assets.id, s.asset.id)).get();
    expect(row?.name).toBe("home.svg");
    expect(row?.relPath).toBe("icons/home.svg");
  });

  it("external refs never abort the rename", async () => {
    const s = setup();
    const result = await executeRename(execInput(s));
    expect(result.staleRefs).toHaveLength(0);
    expect(result.skippedExternal).toHaveLength(1);
  });

  it("stale in-root refs abort with a clean working tree", async () => {
    const s = setup({ usageLine: 99 });
    await expect(executeRename(execInput(s))).rejects.toThrow(RenameError);
    expect(repo.git("status", "--porcelain")).toBe("");
    expect(readFileSync(join(repo.dir, "icons/house.svg"), "utf8")).toBe(SVG);
    expect(readFileSync(join(repo.dir, "src/App.tsx"), "utf8")).toContain("house.svg");
  });

  it("treats the git commit as the point of no return when the index update fails", async () => {
    const s = setup();
    let armed = false;
    const evilDb = new Proxy(s.db, {
      get(target, prop, receiver) {
        if (prop === "transaction" && armed) {
          return () => {
            throw new Error("SQLITE_BUSY: database is locked");
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as Db;
    armed = true;

    const result = await executeRename(execInput(s, { db: evilDb }));

    expect(result.indexStale).toBe(true);
    expect(result.commitSha).toMatch(/^[0-9a-f]{40}$/);
    // files stay renamed: no rollback after the commit
    expect(readFileSync(join(repo.dir, "icons/home.svg"), "utf8")).toBe(SVG);
    expect(repo.git("log", "-1", "--format=%s")).toContain("rename:");
    expect(repo.git("status", "--porcelain")).toBe("");
  });
});
