import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "@/lib/config/schema";
import type { Db } from "@/lib/db/client";
import { resolveColorToken, type TokenCandidate } from "@/lib/db/queries/colors";
import { type NewStyleUsage, styleUsages } from "@/lib/db/schema";
import { findSimilarAsset, getPalette, listDriftTool, resolveTokenForValue } from "@/lib/mcp/tools";
import { createTestDb, seedSource, type TestDb } from "./helpers/test-db";

function seedColors(db: Db, sourceId: number, rows: Partial<NewStyleUsage>[]) {
  const values: NewStyleUsage[] = rows.map((r, i) => ({
    sourceId,
    kind: "color",
    rawToken: r.rawToken ?? r.normalizedValue ?? "x",
    relPath: r.relPath ?? `f${i}.css`,
    contextKind: r.contextKind ?? "css-decl",
    ...r,
  }));
  db.insert(styleUsages).values(values).run();
}

describe("resolveColorToken — union ranking", () => {
  const candidates: TokenCandidate[] = [
    { color: "#1c7a74", token: "--color-accent" },
    { color: "#2d8a52", token: null },
    { color: "#123456", token: "--color-rare" },
  ];

  it("snaps a near-miss to its defined token", () => {
    const r = resolveColorToken("#1c7a75", candidates);
    expect(r.within).toBe(true);
    if (r.within) {
      expect(r.token).toBe("--color-accent");
      expect(r.deltaE).toBeLessThan(6);
    }
  });

  it("does not miss a low-usage exact defined token", () => {
    const r = resolveColorToken("#123456", candidates);
    expect(r).toMatchObject({ within: true, token: "--color-rare" });
  });

  it("returns a palette color without a token when it is closest", () => {
    const r = resolveColorToken("#2e8b53", candidates);
    expect(r).toMatchObject({ within: true, value: "#2d8a52", token: null });
  });

  it("reports no match beyond the threshold", () => {
    const r = resolveColorToken("#e11d48", candidates);
    expect(r.within).toBe(false);
    if (!r.within) expect(r.nearest).not.toBeNull();
  });

  it("breaks equal-distance ties toward the defined token", () => {
    const r = resolveColorToken("#000000", [
      { color: "#000000", token: null },
      { color: "#000000", token: "--black" },
    ]);
    expect(r).toMatchObject({ within: true, token: "--black" });
  });
});

describe("resolveTokenForValue — tool", () => {
  let t: TestDb;
  beforeEach(() => {
    t = createTestDb();
  });
  afterEach(() => t.cleanup());

  it("rejects an unparseable color", () => {
    const s = seedSource(t.db);
    const r = resolveTokenForValue(t.db, s.id, { value: "var(--x)" });
    expect(r).toMatchObject({ ok: false, code: "invalid_input" });
  });

  it("returns a no-match note on a color-less repo", () => {
    const s = seedSource(t.db);
    const r = resolveTokenForValue(t.db, s.id, { value: "#1c7a74" });
    expect(r).toMatchObject({ ok: true, within: false });
  });

  it("resolves against a defined token", () => {
    const s = seedSource(t.db);
    seedColors(t.db, s.id, [
      { normalizedValue: "#1c7a74", contextKind: "css-var-def", contextDetail: "--color-accent" },
      { normalizedValue: "#1c7a74", contextKind: "css-decl", contextDetail: "color" },
    ]);
    const r = resolveTokenForValue(t.db, s.id, { value: "#1c7a75" });
    expect(r).toMatchObject({ ok: true, within: true, token: "--color-accent" });
  });
});

describe("get_palette + list_drift", () => {
  let t: TestDb;
  beforeEach(() => {
    t = createTestDb();
  });
  afterEach(() => t.cleanup());

  it("get_palette returns the palette", () => {
    const s = seedSource(t.db);
    seedColors(t.db, s.id, [{ normalizedValue: "#1c7a74", contextDetail: "color" }]);
    const r = getPalette(t.db, s.id);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.palette[0]?.color).toBe("#1c7a74");
  });

  it("list_drift splits by kind", () => {
    const s = seedSource(t.db);
    const both = listDriftTool(t.db, s.id, {});
    expect(both).toHaveProperty("color");
    expect(both).toHaveProperty("type");
    const colorOnly = listDriftTool(t.db, s.id, { kind: "color" });
    expect(colorOnly).toHaveProperty("color");
    expect(colorOnly).not.toHaveProperty("type");
    const typeOnly = listDriftTool(t.db, s.id, { kind: "type" });
    expect(typeOnly).toHaveProperty("type");
    expect(typeOnly).not.toHaveProperty("color");
  });
});

describe("find_similar_asset — A3 path boundary", () => {
  let t: TestDb;
  let dir: string;
  beforeEach(() => {
    t = createTestDb();
    dir = mkdtempSync(join(tmpdir(), "pika-mcp-"));
  });
  afterEach(() => {
    t.cleanup();
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects a path outside the source root", async () => {
    const s = seedSource(t.db, dir);
    const r = await findSimilarAsset(t.db, s, ConfigSchema.parse({}), { path: "/etc/hosts" });
    expect(r).toMatchObject({ ok: false, code: "invalid_input" });
  });

  it("rejects an unsupported file type in bounds", async () => {
    const s = seedSource(t.db, dir);
    writeFileSync(join(dir, "notes.txt"), "hi");
    const r = await findSimilarAsset(t.db, s, ConfigSchema.parse({}), {
      path: join(dir, "notes.txt"),
    });
    expect(r).toMatchObject({ ok: false, code: "unsupported" });
  });

  it("rejects a symlink that escapes the root", async () => {
    const s = seedSource(t.db, dir);
    const link = join(dir, "escape.svg");
    symlinkSync("/etc/hosts", link);
    const r = await findSimilarAsset(t.db, s, ConfigSchema.parse({}), { path: link });
    expect(r).toMatchObject({ ok: false, code: "invalid_input" });
  });

  it("reports an in-bounds missing file as not readable", async () => {
    const s = seedSource(t.db, dir);
    const r = await findSimilarAsset(t.db, s, ConfigSchema.parse({}), {
      path: join(dir, "ghost.svg"),
    });
    expect(r).toMatchObject({ ok: false, code: "invalid_input" });
  });
});
