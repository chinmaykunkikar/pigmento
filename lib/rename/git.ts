import { execFile } from "node:child_process";

type GitResult = { ok: boolean; stdout: string; stderr: string; code: number | null };

function run(args: string[], cwd: string, timeoutMs = 5000): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile(
      "git",
      args,
      { cwd, timeout: timeoutMs, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const out = String(stdout ?? "");
        const errText = String(stderr ?? "");
        if (err) {
          const code = (err as NodeJS.ErrnoException & { code?: number | string }).code;
          resolve({
            ok: false,
            stdout: out,
            stderr: errText || err.message,
            code: typeof code === "number" ? code : null,
          });
          return;
        }
        resolve({ ok: true, stdout: out, stderr: errText, code: 0 });
      },
    );
  });
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  const r = await run(["rev-parse", "--is-inside-work-tree"], cwd);
  return r.ok && r.stdout.trim() === "true";
}

export async function statusPorcelain(cwd: string, paths: string[]): Promise<GitResult> {
  if (paths.length === 0) return run(["status", "--porcelain"], cwd);
  return run(["status", "--porcelain", "--", ...paths], cwd);
}

export async function gitMove(cwd: string, from: string, to: string): Promise<GitResult> {
  return run(["mv", "--", from, to], cwd);
}

export async function gitAdd(cwd: string, paths: string[]): Promise<GitResult> {
  if (paths.length === 0) return { ok: true, stdout: "", stderr: "", code: 0 };
  return run(["add", "--", ...paths], cwd);
}

export async function gitCommit(cwd: string, message: string): Promise<GitResult> {
  return run(["commit", "-m", message], cwd, 30000);
}

export async function gitResetPaths(cwd: string, paths: string[]): Promise<GitResult> {
  if (paths.length === 0) return { ok: true, stdout: "", stderr: "", code: 0 };
  return run(["reset", "HEAD", "--", ...paths], cwd);
}

export async function gitCheckoutPaths(cwd: string, paths: string[]): Promise<GitResult> {
  if (paths.length === 0) return { ok: true, stdout: "", stderr: "", code: 0 };
  return run(["checkout", "--", ...paths], cwd);
}

export async function headSha(cwd: string): Promise<string | null> {
  const r = await run(["rev-parse", "HEAD"], cwd);
  return r.ok ? r.stdout.trim() || null : null;
}
