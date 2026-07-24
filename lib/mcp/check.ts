import { execFileSync } from "node:child_process";
import { eq } from "drizzle-orm";
import type { Config } from "@/lib/config/schema";
import type { Db } from "@/lib/db/client";
import { type DriftFinding, listColorDrift } from "@/lib/db/queries/colors";
import { listTypeDrift, type TypeDriftFinding } from "@/lib/db/queries/typography";
import { type Source, sources } from "@/lib/db/schema";
import { indexerEvents, type StageEvent } from "@/lib/indexer/events";
import { runIndexer } from "@/lib/indexer/run";
import { RunActiveError } from "@/lib/indexer/run-registry";
import { type Err, err } from "./envelope";

export type CheckReport = {
  ok: true;
  fresh: boolean;
  indexedAt: string | null;
  staleStages: string[];
  color: DriftFinding[];
  type: TypeDriftFinding[];
};

// Advisory only, never exit-code gating. v1 freshens the index (incremental
// re-index) then reports current drift; the precise non-destructive "what this
// diff introduced" overlay is the deferred CI-gate's (D3.3) job. A ref range
// scopes findings to files git reports changed in that range (best-effort:
// deletions/renames are not tracked).
export async function runCheck(
  db: Db,
  source: Source,
  config: Config,
  opts: { refRange?: string } = {},
): Promise<CheckReport | Err> {
  const staleStages: string[] = [];
  const bus = indexerEvents();
  const listener = (ev: StageEvent) => {
    if (ev.sourceId !== source.id) return;
    if (ev.type === "stage-end" && ev.detail.startsWith("FAILED:")) staleStages.push(ev.stage);
  };
  bus.on("event", listener);
  try {
    // check --json prints the report as JSON to stdout; keep reindex progress
    // off stdout so it never corrupts that (or the MCP stream via the tool).
    await runIndexer({ db, source, config, full: false, progressWrite: () => {} });
  } catch (e) {
    if (e instanceof RunActiveError) {
      return err("not_indexed", "an index run is already active", "retry in a few seconds");
    }
    return err(
      "index_failed",
      e instanceof Error ? e.message : String(e),
      "run `pigmento index` to see stage output",
    );
  } finally {
    bus.off("event", listener);
  }

  let color = listColorDrift(db, source.id);
  let type = listTypeDrift(db, source.id);

  if (opts.refRange) {
    const changed = changedFiles(source.root, opts.refRange);
    if (changed === null) {
      return err(
        "invalid_input",
        `could not diff ref range "${opts.refRange}"`,
        "pass a valid git ref range like origin/master..HEAD",
      );
    }
    color = color.filter((d) => d.variants.some((v) => v.file !== null && changed.has(v.file)));
    type = type.filter((d) => d.variants.some((v) => v.file !== null && changed.has(v.file)));
  }

  const [row] = db
    .select({ at: sources.lastIndexedAt })
    .from(sources)
    .where(eq(sources.id, source.id))
    .all();

  return {
    ok: true,
    fresh: staleStages.length === 0,
    indexedAt: row?.at ?? null,
    staleStages,
    color,
    type,
  };
}

// execFile arg-array (no shell) so a hostile ref range is inert.
function changedFiles(root: string, refRange: string): Set<string> | null {
  try {
    const out = execFileSync("git", ["diff", "--name-only", refRange], {
      cwd: root,
      encoding: "utf8",
    });
    return new Set(
      out
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    );
  } catch {
    return null;
  }
}
