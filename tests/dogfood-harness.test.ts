import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectStyleFailures, runDogfood } from "@/scripts/dogfood";

describe("dogfood harness — soft-stage failure detection", () => {
  it("flags a style stage whose detail starts FAILED:", () => {
    const stages = {
      "color-extract": { ms: 5, detail: "120 usages, 100 resolved" },
      "type-extract": { ms: 5, detail: "FAILED: boom" },
      "type-cluster": { ms: 1, detail: "0 near-miss clusters" },
    };
    expect(detectStyleFailures(stages)).toEqual(["type-extract"]);
  });

  it("returns no failures when every style stage succeeded", () => {
    const stages = {
      "color-extract": { ms: 5, detail: "10 usages, 8 resolved" },
      "color-cluster": { ms: 1, detail: "1 near-miss clusters (0 neutral)" },
      "type-extract": { ms: 5, detail: "4 usages, 4 resolved" },
      "type-cluster": { ms: 1, detail: "0 near-miss clusters" },
    };
    expect(detectStyleFailures(stages)).toEqual([]);
  });
});

describe("dogfood harness — end-to-end on a seeded repo", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "pika-dogfood-fixture-"));
    writeFileSync(
      join(dir, "styles.css"),
      `:root { --brand: #402678; }
.a { color: var(--brand); background: #ff0000; font-size: 14px; font-weight: bold; }
.b { color: #3f2678; font-size: 0.875rem; font-weight: 700; }
`,
    );
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("runs the real pipeline into a temp DB and returns the expected shape", async () => {
    const m = await runDogfood(dir, { sample: 5, top: 5 });
    expect(m.styleFailures).toEqual([]);
    expect(m.color.usages).toBeGreaterThan(0);
    expect(m.type.usages).toBeGreaterThan(0);
    expect(Array.isArray(m.color.drift)).toBe(true);
    expect(Array.isArray(m.type.drift)).toBe(true);
    expect(m.type.coverage).toHaveProperty("pct");
    expect(m.latency.totalMs).toBeGreaterThanOrEqual(0);
    expect(m.latency.stages["color-extract"]).toBeDefined();
  });
});
