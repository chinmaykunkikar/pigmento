import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { Command, Option } from "commander";
import { loadConfig } from "@/lib/config/load";
import { getDb } from "@/lib/db/client";
import { countAssets } from "@/lib/db/queries/assets";
import { addSource, getSource, listSources } from "@/lib/db/queries/sources";
import { runIndexer } from "@/lib/indexer/run";
import { isAllowedExt } from "@/lib/match/ext";
import { matchFile } from "@/lib/match/find";
import { runCheck } from "@/lib/mcp/check";
import { buildContextDigest } from "@/lib/mcp/context";
import { runInit } from "@/lib/mcp/init";
import { readToolLogTail } from "@/lib/mcp/log";
import { repoRootOf } from "@/lib/mcp/repo";
import { runMcpServer } from "@/lib/mcp/server";
import { resolveRepoSource } from "@/lib/mcp/source";
import { writePlanArtifacts } from "@/lib/plan/dispatch/artifacts";
import { checkHarness } from "@/lib/plan/dispatch/registry";
import type { DispatchEvent, DispatchHarnessName, RunnableMode } from "@/lib/plan/dispatch/types";
import { planSchema } from "@/lib/plan/schema";

const out = (s: string) => process.stdout.write(`${s}\n`);
const err = (s: string) => process.stderr.write(`${s}\n`);

const program = new Command();

const pkg = createRequire(import.meta.url)("../package.json") as { version: string };

program
  .name("pigmento")
  .description("pigmento · the asset manager for your codebase")
  .version(pkg.version);

program
  .command("index")
  .description("Index all configured sources")
  .option("--full", "drop caches and re-scan everything", false)
  .action(async (opts: { full: boolean }) => {
    const db = getDb();
    const config = await loadConfig();
    const srcs = listSources(db);
    if (srcs.length === 0) {
      err("no sources configured. run `pnpm pigmento source add <path>` first");
      process.exit(1);
    }
    for (const source of srcs) {
      await runIndexer({ db, source, config, full: opts.full });
    }
  });

program
  .command("status")
  .description("Show index status per source")
  .option("--agent", "show recent MCP tool calls instead", false)
  .action((opts: { agent: boolean }) => {
    if (opts.agent) {
      const tail = readToolLogTail(`${repoRootOf(process.cwd())}/data/pika.db`);
      if (tail.length === 0) {
        out("no agent tool calls logged");
        return;
      }
      for (const e of tail) {
        out(`${e.ts}  ${e.tool.padEnd(24)} ${e.code.padEnd(12)} ${String(e.ms).padStart(6)}ms`);
      }
      return;
    }
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
  .addOption(
    new Option("-m, --mode <mode>", "dispatch mode")
      .choices(["dry-run", "patch", "open-pr"])
      .default("patch"),
  )
  .addOption(
    new Option("-H, --harness <harness>", "agent harness")
      .choices(["claude-code", "devin", "codex-cli"])
      .default("claude-code"),
  )
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
  .option("--json", "machine-readable output", false)
  .action(async (file: string, opts: { source?: string; threshold: string; json: boolean }) => {
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
    const { signature, buckets: rawBuckets } = await matchFile(
      db,
      source.id,
      buf,
      basename(abs),
      clipEnabled,
    );
    const buckets = {
      ...rawBuckets,
      near: rawBuckets.near.filter((m) => m.hamming <= thresholdRaw),
    };

    if (opts.json) {
      out(JSON.stringify({ signature, clipEnabled, threshold: thresholdRaw, buckets }, null, 2));
      return;
    }

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

program
  .command("mcp")
  .description("Run the MCP stdio server (agent surface)")
  .action(async () => {
    await runMcpServer();
  });

program
  .command("check [ref-range]")
  .description("Advisory drift report (re-indexes, then lists drift; never gates)")
  .option("--json", "machine-readable output", false)
  .action(async (refRange: string | undefined, opts: { json: boolean }) => {
    const { db, source, config } = await resolveRepoSource();
    const report = await runCheck(db, source, config, { refRange });
    if (opts.json) {
      out(JSON.stringify(report, null, 2));
      return;
    }
    if (!report.ok) {
      err(`${report.code}: ${report.message} — ${report.remedy}`);
      process.exit(1);
    }
    out(`${source.label}  indexed ${report.indexedAt ?? "never"}`);
    if (report.staleStages.length > 0) out(`  stale stages: ${report.staleStages.join(", ")}`);
    out(`  color drift: ${report.color.length}   type drift: ${report.type.length}`);
    for (const d of report.color.slice(0, 10)) {
      const v = d.variants[0];
      const loc = v ? `${v.file}:${v.line}` : "";
      out(`  color ${d.canonical} <- ${d.variants.length}  ${loc}  → ${d.suggestedToken}`);
    }
    for (const d of report.type.slice(0, 10)) {
      const v = d.variants[0];
      const loc = v ? `${v.file}:${v.line}` : "";
      out(`  type [${d.axis}] ${d.canonical} <- ${d.variants.length}  ${loc}`);
    }
  });

program
  .command("context")
  .description("Print a compact design digest for prompt injection")
  .action(async () => {
    const { db, source } = await resolveRepoSource();
    out(buildContextDigest(db, source));
  });

program
  .command("init")
  .description("Write the pigmento agent-guidance block into CLAUDE.md / AGENTS.md")
  .action(() => {
    for (const p of runInit().written) out(`wrote block -> ${p}`);
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
