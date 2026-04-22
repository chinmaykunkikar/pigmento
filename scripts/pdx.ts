import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { Command } from "commander";
import { loadConfig } from "../lib/config/load";
import { getDb } from "../lib/db/client";
import { countAssets } from "../lib/db/queries/assets";
import { addSource, listSources } from "../lib/db/queries/sources";
import { runIndexer } from "../lib/indexer/run";

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

program.parseAsync(process.argv).catch((e) => {
  err(String(e));
  process.exit(1);
});
