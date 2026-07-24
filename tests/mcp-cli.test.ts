import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { styleUsages } from "@/lib/db/schema";
import { buildContextDigest } from "@/lib/mcp/context";
import { renderBlock, runInit, upsertBlock } from "@/lib/mcp/init";
import { createTestDb, seedAsset, seedSource, type TestDb } from "./helpers/test-db";

describe("init — marker block", () => {
  it("upsertBlock is idempotent", () => {
    const once = upsertBlock("# My project\n\nStuff.\n");
    expect(upsertBlock(once)).toBe(once);
    expect(once).toContain(renderBlock());
  });

  it("upsertBlock replaces an existing block in place", () => {
    const first = upsertBlock("");
    const edited = first.replace("(pigmento)", "(pigmento) EDITED");
    expect(upsertBlock(edited)).toBe(first);
  });

  it("runInit creates AGENTS.md when neither exists, byte-identical on re-run", () => {
    const dir = mkdtempSync(join(tmpdir(), "pika-init-"));
    try {
      const r1 = runInit(dir);
      expect(r1.written).toHaveLength(1);
      const first = readFileSync(join(dir, "AGENTS.md"), "utf8");
      runInit(dir);
      expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(first);
      expect(first).toContain("pigmento:start");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("context — digest", () => {
  let t: TestDb;
  beforeEach(() => {
    t = createTestDb();
  });
  afterEach(() => t.cleanup());

  it("is byte-stable across runs on an unchanged index", () => {
    const s = seedSource(t.db);
    t.db
      .insert(styleUsages)
      .values([
        {
          sourceId: s.id,
          kind: "color",
          normalizedValue: "#1c7a74",
          rawToken: "#1c7a74",
          relPath: "a.css",
          contextKind: "css-decl",
          contextDetail: "color",
        },
        {
          sourceId: s.id,
          kind: "color",
          normalizedValue: "#1c7a74",
          rawToken: "#1c7a74",
          relPath: "b.css",
          contextKind: "css-decl",
          contextDetail: "background",
        },
      ])
      .run();
    seedAsset(t.db, s.id, { name: "cart.svg", dir: "icons" });

    const a = buildContextDigest(t.db, s);
    expect(buildContextDigest(t.db, s)).toBe(a);
    expect(a).toContain("# pigmento");
    expect(a).toContain("#1c7a74");
  });
});
