import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "@/lib/config/schema";
import { getColorStats } from "@/lib/db/queries/colors";
import { listSources } from "@/lib/db/queries/sources";
import { doIndex } from "@/lib/mcp/source";
import { createTestDb, type TestDb } from "./helpers/test-db";

describe("mcp cold start — doIndex", () => {
  let t: TestDb;
  let dir: string;
  beforeEach(() => {
    t = createTestDb();
    dir = mkdtempSync(join(tmpdir(), "pika-cold-"));
  });
  afterEach(() => {
    t.cleanup();
    rmSync(dir, { recursive: true, force: true });
  });

  it("seeds a source and indexes a fresh repo's colors", async () => {
    writeFileSync(join(dir, "styles.css"), ":root { --brand: #1c7a74; }\na { color: #1c7a74; }\n");
    await doIndex(t.db, dir, null, ConfigSchema.parse({ codeRoots: [] }));

    const srcs = listSources(t.db);
    expect(srcs).toHaveLength(1);
    const src = srcs[0];
    expect(src).toBeDefined();
    if (!src) return;
    expect(src.lastIndexedAt).not.toBeNull();
    expect(getColorStats(t.db, src.id).perColor.some((c) => c.color === "#1c7a74")).toBe(true);
  });
});
