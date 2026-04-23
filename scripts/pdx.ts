import { readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { Command } from "commander";
import { loadConfig } from "@/lib/config/load";
import { getDb } from "@/lib/db/client";
import { countAssets } from "@/lib/db/queries/assets";
import { addSource, getSource, listSources } from "@/lib/db/queries/sources";
import { runIndexer } from "@/lib/indexer/run";
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
