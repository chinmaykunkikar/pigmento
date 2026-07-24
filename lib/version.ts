import { createRequire } from "node:module";

// The CLI bundle (scripts/build-cli.mjs) injects the version via esbuild `define`,
// because a bundled dist/cli.js can't read ../package.json at the depth the source
// tree assumes. In dev (tsx, unbundled) the global is absent, so read it off the
// repo root: this file lives at <root>/lib/version.ts.
declare const __PIGMENTO_VERSION__: string | undefined;

function readVersion(): string {
  if (typeof __PIGMENTO_VERSION__ === "string") return __PIGMENTO_VERSION__;
  const pkg = createRequire(import.meta.url)("../package.json") as { version: string };
  return pkg.version;
}

export const version = readVersion();
