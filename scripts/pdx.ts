import { Command } from "commander";

const out = (s: string) => process.stdout.write(`${s}\n`);

const program = new Command();

program.name("pdx").description("PixelDex CLI: local-first asset explorer").version("0.0.0");

program
  .command("index")
  .description("Index all assets in the configured sources")
  .option("--full", "drop caches and re-scan everything", false)
  .action((opts: { full: boolean }) => {
    out(opts.full ? "index --full: not yet implemented" : "index: not yet implemented");
  });

program
  .command("status")
  .description("Show index status")
  .action(() => {
    out("status: not yet implemented");
  });

const source = program.command("source").description("Manage sources");

source
  .command("add <path>")
  .description("Add a new source directory")
  .option("-l, --label <label>", "human-readable label")
  .action((path: string, opts: { label?: string }) => {
    out(`source add: not yet implemented (path=${path}, label=${opts.label ?? "-"})`);
  });

source
  .command("list")
  .description("List configured sources")
  .action(() => {
    out("source list: not yet implemented");
  });

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`${String(err)}\n`);
  process.exit(1);
});
