import { execFile } from "node:child_process";
import { dirname } from "node:path";

export function gitAuthor(absPath: string, timeoutMs = 500): Promise<string | null> {
  return new Promise((resolve) => {
    const child = execFile(
      "git",
      ["log", "-1", "--format=%an", "--", absPath],
      { cwd: dirname(absPath), timeout: timeoutMs, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout) return resolve(null);
        resolve(stdout.trim() || null);
      },
    );
    child.on("error", () => resolve(null));
  });
}
