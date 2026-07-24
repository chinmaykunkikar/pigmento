import { chmod, cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const pkg = createRequire(import.meta.url)("../package.json");

// Externalize every runtime dependency by name (NOT esbuild's packages:'external',
// which also externalizes the @/ alias and leaves it unresolved). Native deps
// (better-sqlite3, sharp) and the optional CLIP stack must stay external; only our
// own first-party @/… code gets bundled.
const external = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
];

const dist = resolve(root, "dist");
const outfile = resolve(dist, "cli.js");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await build({
  entryPoints: [resolve(root, "scripts/pigmento.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external,
  alias: { "@": root },
  banner: { js: "#!/usr/bin/env node" },
  define: {
    __PIGMENTO_VERSION__: JSON.stringify(pkg.version),
    __PIGMENTO_BUNDLED__: "true",
  },
  logLevel: "info",
});

// drizzle applies these .sql files at runtime; ship them beside the bundle where
// lib/mcp/source.ts (bundled) resolves them via import.meta.dirname + "migrations".
await cp(resolve(root, "lib/db/migrations"), resolve(dist, "migrations"), { recursive: true });
await chmod(outfile, 0o755);
