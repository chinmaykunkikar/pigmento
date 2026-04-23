import { readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { Command } from "commander";
import { loadConfig } from "@/lib/config/load";
import { getDb } from "@/lib/db/client";
import { countAssets } from "@/lib/db/queries/assets";
import { findMatches } from "@/lib/db/queries/matches";
import { addSource, getSource, listSources } from "@/lib/db/queries/sources";
import { runIndexer } from "@/lib/indexer/run";
import { embedImage } from "@/lib/match/clip";
import { isAllowedExt, normalizeExt } from "@/lib/match/ext";
import { computeSignature } from "@/lib/match/signature";
import { writePlanArtifacts } from "@/lib/plan/dispatch/artifacts";
import { checkHarness } from "@/lib/plan/dispatch/registry";
import type { DispatchEvent, DispatchHarnessName, RunnableMode } from "@/lib/plan/dispatch/types";
import { planSchema } from "@/lib/plan/schema";

const out = (s: string) => process.stdout.write(`${s}\n`);
const err = (s: string) => process.stderr.write(`${s}\n`);

const program = new Command();

program.name("pdx").description("PixelDex CLI: local-first asset explorer").version("0.0.0");

program
  .command("index")
  .description("Index all configured sources")
  .option("--full", "drop caches and re-scan everything", false)
  .action(async (opts: { full: boolean }) => {
    const db = getDb();
    const config = await loadConfig();
    const srcs = listSources(db);
    if (srcs.length === 0) {
      err("no sources configured. run `pnpm pdx source add <path>` first");
      process.exit(1);
    }
    for (const source of srcs) {
      await runIndexer({ db, source, config, full: opts.full });
    }
  });

program
  .command("status")
  .description("Show index status per source")
  .action(() => {
    const db = getDb();
    const srcs = listSources(db);
    if (srcs.length === 0) {
      out("no sources configured");
      return;
    }
    for (const s of srcs) {
      const n = countAssets(db, s.id);
      const label = s.label.padEnd(24);
      const n6 = String(n).padStart(6);
      out(`[${s.id}] ${label} ${n6} assets  ${s.root}`);
    }
  });

const sourceCmd = program.command("source").description("Manage sources");

sourceCmd
  .command("add <path>")
  .description("Add a new source directory")
  .option("-l, --label <label>", "human-readable label")
  .action(async (path: string, opts: { label?: string }) => {
    const abs = resolve(path);
    const st = await stat(abs).catch(() => null);
    if (!st) {
      err(`path does not exist: ${abs}`);
      process.exit(1);
    }
    if (!st.isDirectory()) {
      err(`not a directory: ${abs}`);
      process.exit(1);
    }
    const db = getDb();
    const label = opts.label ?? basename(abs);
    const row = addSource(db, { root: abs, label });
    out(`added [${row.id}] ${row.label} -> ${row.root}`);
  });

sourceCmd
  .command("list")
  .description("List configured sources")
  .action(() => {
    const db = getDb();
    const srcs = listSources(db);
    if (srcs.length === 0) {
      out("no sources configured");
      return;
    }
    for (const s of srcs) {
      out(`[${s.id}] ${s.label}  ${s.root}`);
    }
  });

const planCmd = program.command("plan").description("Work with cleanup plans");

planCmd
  .command("send <plan-file>")
  .description("Send a saved plan to an agent harness")
  .option("-m, --mode <mode>", "dispatch mode: dry-run, patch, open-pr", "patch")
  .option("-H, --harness <harness>", "harness: claude-code, devin, codex-cli", "claude-code")
  .action(
    async (
      planFile: string,
      opts: { mode: RunnableMode | "dry-run"; harness: DispatchHarnessName },
    ) => {
      const abs = resolve(planFile);
      const raw = await readFile(abs, "utf8").catch(() => null);
      if (!raw) {
        err(`plan file not found: ${abs}`);
        process.exit(1);
      }
      const parsed = planSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        err(`invalid plan: ${parsed.error.issues[0]?.message ?? "unknown"}`);
        process.exit(1);
      }
      const plan = parsed.data;
      const db = getDb();
      const source = getSource(db, plan.sourceId);
      if (!source) {
        err(`source ${plan.sourceId} not found in db`);
        process.exit(1);
      }

      const artifacts = await writePlanArtifacts(plan, source.root, opts.mode);
      out(`wrote ${artifacts.jsonPath}`);
      out(`wrote ${artifacts.promptPath}`);

      if (opts.mode === "dry-run") {
        out(`dry-run complete. prompt: ${artifacts.promptPath}`);
        return;
      }

      const { harness, readiness } = await checkHarness(opts.harness, opts.mode);
      if (!harness || !readiness.ready) {
        err(readiness.ready ? `${opts.harness} adapter missing` : readiness.reason);
        process.exit(1);
      }

      const ac = new AbortController();
      process.on("SIGINT", () => ac.abort());
      process.on("SIGTERM", () => ac.abort());

      let exitCode = 0;
      for await (const ev of harness.run(
        { plan, mode: opts.mode, cwd: source.root, planDir: artifacts.dir },
        ac.signal,
      )) {
        printEvent(ev);
        if (ev.type === "done") exitCode = ev.exitCode;
        if (ev.type === "error") exitCode = 1;
      }
      process.exit(exitCode);
    },
  );

program
  .command("match <file>")
  .description("Find matches for a file in an indexed source")
  .option("-s, --source <id>", "source id (defaults to first source)")
  .option("-t, --threshold <n>", "pHash Δ ceiling for near matches (0–20, default 12)", "12")
  .action(async (file: string, opts: { source?: string; threshold: string }) => {
    const abs = resolve(file);
    const st = await stat(abs).catch(() => null);
    if (!st?.isFile()) {
      err(`not a file: ${abs}`);
      process.exit(1);
    }
    if (!isAllowedExt(basename(abs))) {
      err("unsupported file type (svg, png, jpg, webp, gif only)");
      process.exit(1);
    }

    const db = getDb();
    const sources = listSources(db);
    const source = opts.source ? sources.find((s) => s.id === Number(opts.source)) : sources[0];
    if (!source) {
      err(opts.source ? `source ${opts.source} not found` : "no sources configured");
      process.exit(1);
    }

    const thresholdRaw = Number(opts.threshold);
    if (!Number.isInteger(thresholdRaw) || thresholdRaw < 0 || thresholdRaw > 20) {
      err("--threshold must be an integer between 0 and 20");
      process.exit(1);
    }

    const config = await loadConfig();
    const clipEnabled = config.clip.enabled;

    const buf = await readFile(abs);
    const [signature, embedding] = await Promise.all([
      computeSignature(buf, basename(abs)),
      clipEnabled ? embedImage(buf, normalizeExt(basename(abs))) : Promise.resolve(null),
    ]);
    const rawBuckets = findMatches(db, source.id, signature, embedding);
    const buckets = {
      ...rawBuckets,
      near: rawBuckets.near.filter((m) => m.hamming <= thresholdRaw),
    };

    out(`${signature.name}  (${source.label})`);
    out(`  sha1      ${signature.sha1}`);
    out(`  content   ${signature.contentHash}`);
    if (signature.phash) out(`  phash     ${signature.phash}`);
    if (signature.width && signature.height) {
      out(`  bounding  ${signature.width} × ${signature.height}`);
    }
    if (signature.dominantColor) out(`  dominant  ${signature.dominantColor}`);

    printBucket(
      "Exact content match",
      buckets.exact.map((m) => `${refs(m.usageCount)}  ${m.relPath}`),
    );
    printBucket(
      `Near matches (pHash Δ ≤ ${thresholdRaw})`,
      buckets.near.map(
        (m) => `Δ${String(m.hamming).padStart(2)}  ${m.pct}%  ${refs(m.usageCount)}  ${m.relPath}`,
      ),
    );
    printBucket(
      "Name clusters",
      buckets.name.map(
        (m) =>
          `${Math.round(m.score * 100)}%  ${refs(m.usageCount)}  [${m.sharedTokens.join(" ")}]  ${m.relPath}`,
      ),
    );
    if (clipEnabled) {
      printBucket(
        "Semantic matches",
        buckets.semantic.map(
          (m) => `${Math.round(m.score * 100)}%  ${refs(m.usageCount)}  ${m.relPath}`,
        ),
      );
    }
  });

function refs(n: number): string {
  return `${String(n).padStart(3)} ref${n === 1 ? " " : "s"}`;
}

function printBucket(label: string, rows: string[]) {
  out("");
  if (rows.length === 0) {
    out(`${label}: -`);
    return;
  }
  out(`${label}: ${rows.length}`);
  for (const r of rows) out(`  ${r}`);
}

function printEvent(ev: DispatchEvent) {
  if (ev.type === "stderr") err(ev.line);
  else if (ev.type === "done") out(`• exit ${ev.exitCode}${ev.prUrl ? ` · ${ev.prUrl}` : ""}`);
  else if (ev.type === "error") err(`✗ ${ev.message}`);
  else if ("line" in ev) out(ev.line);
}

program.parseAsync(process.argv).catch((e) => {
  err(String(e));
  process.exit(1);
});
