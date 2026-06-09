import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type TempGitRepo = {
  dir: string;
  write: (relPath: string, content: string) => string;
  commit: (message: string) => string;
  git: (...args: string[]) => string;
  cleanup: () => void;
};

export function createTempGitRepo(): TempGitRepo {
  const dir = mkdtempSync(join(tmpdir(), "pika-git-"));

  const git = (...args: string[]): string =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();

  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@pika.local");
  git("config", "user.name", "Pika Test");
  git("config", "commit.gpgsign", "false");

  const write = (relPath: string, content: string): string => {
    const abs = join(dir, relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    return abs;
  };

  const commit = (message: string): string => {
    git("add", "-A");
    git("commit", "-q", "-m", message);
    return git("rev-parse", "HEAD");
  };

  return {
    dir,
    write,
    commit,
    git,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
