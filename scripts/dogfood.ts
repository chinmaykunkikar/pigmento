import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import Database from "better-sqlite3";
import { and, count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { ConfigSchema } from "@/lib/config/schema";
import type { Db } from "@/lib/db/client";
import { derivePalette, getColorStats, listColorDrift } from "@/lib/db/queries/colors";
import {
  deriveMixedSpellings,
  getTypographyScale,
  getTypographyStats,
  listTypeDrift,
} from "@/lib/db/queries/typography";
import * as schema from "@/lib/db/schema";
import { styleUsages } from "@/lib/db/schema";
import { indexerEvents, type StageEvent } from "@/lib/indexer/events";
import { runIndexer } from "@/lib/indexer/run";

const STYLE_STAGES = ["color-extract", "color-cluster", "type-extract", "type-cluster"];
const MIGRATIONS = resolve(import.meta.dirname, "../lib/db/migrations");

export type StageRecord = { ms: number; detail: string };

// The one behaviour a green metrics shape would otherwise hide (codex #3): a soft
// style stage that caught, marked FAILED:, and let the run complete.
export function detectStyleFailures(stages: Record<string, StageRecord>): string[] {
  return STYLE_STAGES.filter((s) => stages[s]?.detail.startsWith("FAILED:"));
}

function sampleRows<T>(rows: T[], n: number): T[] {
  if (rows.length <= n) return rows;
  const step = rows.length / n;
  return Array.from({ length: n }, (_, i) => rows[Math.floor(i * step)] as T);
}

function kindCount(
  db: Db,
  sourceId: number,
  kind: string,
  table: typeof schema.styleClusters | typeof styleUsages,
) {
  return (
    db
      .select({ n: count() })
      .from(table)
      .where(and(eq(table.sourceId, sourceId), eq(table.kind, kind)))
      .all()[0]?.n ?? 0
  );
}

export type DogfoodOptions = { clip?: boolean; sample?: number; top?: number };

// runIndexer emits on a process-global event bus keyed by sourceId, and every
// temp DB seeds its first source as id 1, so two concurrent runs in one process
// would cross-contaminate each other's stage map. Fail fast — this is sequential.
let dogfoodRunning = false;

export async function runDogfood(repoPath: string, opts: DogfoodOptions = {}) {
  if (dogfoodRunning) {
    throw new Error("runDogfood is not concurrency-safe in one process; run repos sequentially");
  }
  dogfoodRunning = true;
  const sampleN = opts.sample ?? 30;
  const topN = opts.top ?? 10;
  const dir = mkdtempSync(join(tmpdir(), "pika-dogfood-"));
  const sqlite = new Database(join(dir, "t.db"));
  const emitter = indexerEvents();
  let onEvent: ((ev: StageEvent) => void) | undefined;
  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: MIGRATIONS });

    // codeRoots: [] — the default ./src,./app are relative to THIS checkout and would
    // pull pigmento's own styles into the report (codex #1). source.root covers the repo.
    const config = ConfigSchema.parse({ codeRoots: [], clip: { enabled: !!opts.clip } });
    const [source] = db
      .insert(schema.sources)
      .values({ root: resolve(repoPath), label: basename(repoPath) })
      .returning()
      .all();
    if (!source) throw new Error("failed to seed source");

    const stages: Record<string, StageRecord> = {};
    onEvent = (ev: StageEvent) => {
      if (ev.sourceId !== source.id) return;
      if (ev.type === "stage-end") stages[ev.stage] = { ms: ev.ms, detail: ev.detail };
    };
    emitter.on("event", onEvent);

    const t0 = Date.now();
    await runIndexer({ db, source, config, full: true });
    const totalMs = Date.now() - t0;

    const clipStatus = stages.clip?.detail ?? null;
    const styleFailures = detectStyleFailures(stages);
    // CLIP-on that silently fell back to no embeddings is not a valid CLIP-on run (codex #11).
    const clipUnavailable = !!opts.clip && (clipStatus?.includes("model unavailable") ?? false);

    const colorStats = getColorStats(db, source.id);
    const typeStats = getTypographyStats(db, source.id);
    const colorSample = sampleRows(
      db
        .select({
          raw: styleUsages.rawToken,
          normalized: styleUsages.normalizedValue,
          relPath: styleUsages.relPath,
          line: styleUsages.line,
          contextKind: styleUsages.contextKind,
        })
        .from(styleUsages)
        .where(and(eq(styleUsages.sourceId, source.id), eq(styleUsages.kind, "color")))
        .all(),
      sampleN,
    );
    const typeSample = sampleRows(
      db
        .select({
          raw: styleUsages.rawToken,
          normalized: styleUsages.normalizedValue,
          axis: styleUsages.axis,
          relPath: styleUsages.relPath,
          line: styleUsages.line,
          contextKind: styleUsages.contextKind,
        })
        .from(styleUsages)
        .where(and(eq(styleUsages.sourceId, source.id), eq(styleUsages.kind, "type")))
        .all(),
      sampleN,
    );

    return {
      repo: basename(repoPath),
      repoPath: resolve(repoPath),
      clip: !!opts.clip,
      clipStatus,
      clipUnavailable,
      latency: { totalMs, stages },
      styleFailures,
      color: {
        usages: kindCount(db, source.id, "color", styleUsages),
        clusters: kindCount(db, source.id, "color", schema.styleClusters),
        coverage: colorStats.coverage,
        palette: derivePalette(colorStats, topN),
        drift: listColorDrift(db, source.id).slice(0, topN),
        sample: colorSample,
      },
      type: {
        usages: kindCount(db, source.id, "type", styleUsages),
        clusters: kindCount(db, source.id, "type", schema.styleClusters),
        coverage: typeStats.coverage,
        scale: getTypographyScale(db, source.id),
        drift: listTypeDrift(db, source.id).slice(0, topN),
        mixed: deriveMixedSpellings(typeStats).slice(0, topN),
        sample: typeSample,
      },
    };
  } finally {
    if (onEvent) emitter.off("event", onEvent);
    sqlite.close();
    rmSync(dir, { recursive: true, force: true });
    dogfoodRunning = false;
  }
}

type Metrics = Awaited<ReturnType<typeof runDogfood>>;

function fmt(metrics: Metrics): string {
  const L = metrics.latency;
  const lines: string[] = [];
  lines.push(`\n=== ${metrics.repo} (clip=${metrics.clip}) ===`);
  lines.push(
    `latency ${L.totalMs}ms  [${Object.entries(L.stages)
      .map(([s, r]) => `${s}:${r.ms}`)
      .join(" ")}]`,
  );
  if (metrics.styleFailures.length)
    lines.push(`STYLE FAILURES: ${metrics.styleFailures.join(", ")}`);
  if (metrics.clipUnavailable) lines.push(`CLIP UNAVAILABLE — clip-on latency is INVALID`);
  const c = metrics.color;
  lines.push(
    `\ncolor: ${c.usages} usages, ${c.clusters} near-miss clusters, coverage ${c.coverage.pct == null ? "n/a" : `${(c.coverage.pct * 100).toFixed(1)}%`}`,
  );
  lines.push(
    `  palette: ${c.palette
      .slice(0, 8)
      .map((p) => `${p.color}×${p.usageCount}`)
      .join("  ")}`,
  );
  lines.push(`  drift top-${c.drift.length}:`);
  for (const d of c.drift)
    lines.push(
      `    ${d.canonical} <- ${d.variants.map((v) => `${v.color}(${v.usageCount}@${v.file}:${v.line},Δ${v.deltaE?.toFixed(2)})`).join(", ")} ${d.neutral ? "[neutral]" : ""} susp=${d.suspicion.toFixed(2)}`,
    );
  const t = metrics.type;
  lines.push(
    `\ntype: ${t.usages} usages, ${t.clusters} near-miss clusters, coverage ${t.coverage.pct == null ? "n/a" : `${(t.coverage.pct * 100).toFixed(1)}%`}`,
  );
  lines.push(`  sizes: ${t.scale.sizes.map((s) => `${s.value}×${s.usageCount}`).join("  ")}`);
  lines.push(`  weights: ${t.scale.weights.map((w) => `${w.value}×${w.usageCount}`).join("  ")}`);
  lines.push(
    `  families: ${t.scale.families
      .slice(0, 6)
      .map((f) => `${f.value}×${f.usageCount}`)
      .join("  ")}`,
  );
  lines.push(`  drift top-${t.drift.length}:`);
  for (const d of t.drift)
    lines.push(
      `    [${d.axis}] ${d.canonical} <- ${d.variants.map((v) => `${v.value}(${v.usageCount}@${v.file}:${v.line})`).join(", ")} susp=${d.suspicion.toFixed(2)}`,
    );
  lines.push(
    `  mixed-spelling: ${t.mixed.map((m) => `[${m.axis}]${m.value}=${m.spellings.map((s) => `${s.raw}×${s.count}`).join("|")}`).join("  ")}`,
  );
  return lines.join("\n");
}

const VALUE_FLAGS = new Set(["--json", "--sample", "--top"]);

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  // the positional repo is the first token that is neither a flag nor a flag's value
  const valueIdx = new Set<number>();
  args.forEach((a, i) => {
    if (VALUE_FLAGS.has(a)) valueIdx.add(i + 1);
  });
  const repo = args.find((a, i) => !a.startsWith("--") && !valueIdx.has(i));
  if (!repo) {
    process.stderr.write(
      "usage: tsx scripts/dogfood.ts <repo-path> [--clip] [--json <out>] [--sample N] [--top N]\n",
    );
    process.exit(2);
  }
  const metrics = await runDogfood(repo, {
    clip: args.includes("--clip"),
    sample: flag("--sample") ? Number(flag("--sample")) : undefined,
    top: flag("--top") ? Number(flag("--top")) : undefined,
  });
  const jsonOut = flag("--json");
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(metrics, null, 2));
  process.stdout.write(`${fmt(metrics)}\n`);
  const clipInvalid = metrics.clip && metrics.clipUnavailable;
  if (metrics.styleFailures.length > 0 || clipInvalid) {
    if (metrics.styleFailures.length > 0) {
      process.stderr.write(
        `\nGATE FAIL: style stage(s) failed: ${metrics.styleFailures.join(", ")}\n`,
      );
    }
    if (clipInvalid) {
      process.stderr.write(
        "\nGATE FAIL: --clip requested but the CLIP model was unavailable; the latency is not a valid CLIP-on measurement\n",
      );
    }
    process.exit(1);
  }
}

if (process.argv[1]?.includes("dogfood")) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });
}
