import { basename, dirname, extname, relative } from "node:path";
import fg from "fast-glob";
import type { ScannedFile } from "./types";

export async function scan(
  root: string,
  opts: { extensions: string[]; ignore: string[] },
): Promise<ScannedFile[]> {
  const pattern = `**/*.{${opts.extensions.join(",")}}`;
  const entries = await fg(pattern, {
    cwd: root,
    ignore: opts.ignore,
    absolute: true,
    stats: true,
    onlyFiles: true,
    dot: false,
    suppressErrors: true,
  });

  return entries.map((e): ScannedFile => {
    const absPath = e.path;
    const relPath = relative(root, absPath);
    const name = basename(absPath);
    const rawExt = extname(name).slice(1).toLowerCase();
    const ext = rawExt === "jpeg" ? "jpg" : rawExt;
    const stem = rawExt ? name.slice(0, -(rawExt.length + 1)) : name;
    const dir = dirname(relPath);
    if (!e.stats) {
      throw new Error(`fast-glob returned no stats for ${absPath}`);
    }
    return {
      absPath,
      relPath,
      dir: dir === "." ? "" : dir,
      name,
      stem,
      ext,
      size: e.stats.size,
      mtime: e.stats.mtimeMs,
    };
  });
}
