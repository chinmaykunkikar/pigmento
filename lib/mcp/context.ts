import { count, desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { derivePalette, getColorStats } from "@/lib/db/queries/colors";
import { getTypographyScale } from "@/lib/db/queries/typography";
import { assets, type Source } from "@/lib/db/schema";

// Compact markdown digest in a fixed section order. Every value is derived from
// the index with deterministic sorts, so the output is byte-stable across runs on
// an unchanged index (prompt-cacheable).
export function buildContextDigest(db: Db, source: Source): string {
  const stats = getColorStats(db, source.id);
  const palette = derivePalette(stats, 12);
  const scale = getTypographyScale(db, source.id);
  const dirs = canonicalDirs(db, source.id);

  const lines: string[] = [];
  lines.push(`# pigmento · design ground truth (${source.label})`, "");
  lines.push("## Brand palette");
  lines.push(
    palette.length
      ? palette.map((p) => `${p.color} ×${p.usageCount}`).join(" · ")
      : "(none indexed)",
  );
  lines.push("", "## Type scale");
  lines.push(`sizes: ${scale.sizes.map((s) => s.value).join(" · ") || "(none)"}`);
  lines.push(
    `families: ${scale.families.map((f) => `${f.value} ×${f.usageCount}`).join(" · ") || "(none)"}`,
  );
  lines.push(`weights: ${scale.weights.map((w) => w.value).join(" · ") || "(none)"}`);
  lines.push("", "## Tokenization");
  lines.push(
    `color coverage ${pct(stats.coverage.pct)} · type coverage ${pct(scale.coverage.pct)}`,
  );
  lines.push(`canonical asset dirs: ${dirs.join(", ") || "(none)"}`);
  lines.push("");
  return lines.join("\n");
}

function pct(v: number | null): string {
  return v === null ? "n/a" : `${Math.round(v * 100)}%`;
}

function canonicalDirs(db: Db, sourceId: number): string[] {
  return db
    .select({ dir: assets.dir, n: count() })
    .from(assets)
    .where(eq(assets.sourceId, sourceId))
    .groupBy(assets.dir)
    .orderBy(desc(count()), assets.dir)
    .limit(3)
    .all()
    .map((r) => r.dir)
    .filter((d) => d.length > 0);
}
