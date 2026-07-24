import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

export function realpathOrSelf(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

// The repo the tool is mounted in = the git top-level of cwd, realpath-normalized
// so symlinked/relative launches resolve to the same source row. Falls back to
// cwd when not a git repo.
export function repoRootOf(cwd: string): string {
  try {
    const top = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
    }).trim();
    if (top) return realpathOrSelf(top);
  } catch {
    // not a git repo (or git missing) — fall through to cwd
  }
  return realpathOrSelf(resolve(cwd));
}
