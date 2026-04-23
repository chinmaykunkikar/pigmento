import { readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, posix, resolve } from "node:path";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { type Asset, assets, usages } from "@/lib/db/schema";
import {
  gitAdd,
  gitCheckoutPaths,
  gitCommit,
  gitMove,
  gitResetPaths,
  headSha,
  isGitRepo,
  statusPorcelain,
} from "./git";
import { validateRename } from "./validate";

export type StaleRef = { usageId: number; relPath: string; line: number };

export type ExecuteResult = {
  assetId: number;
  newRelPath: string;
  newAbsPath: string;
  newName: string;
  updatedUsageCount: number;
  commitSha: string | null;
  staleRefs: StaleRef[];
  affectedRelPaths: string[];
};

export type ExecuteInput = {
  db: Db;
  asset: Asset;
  sourceRoot: string;
  sourceId: number;
  newNameRaw: string;
  acceptedUsageIds: number[] | "all";
  skipStale: boolean;
};

export async function executeRename(input: ExecuteInput): Promise<ExecuteResult> {
  const { db, asset, sourceRoot, sourceId, newNameRaw, acceptedUsageIds, skipStale } = input;

  const pre = await validateRename({ db, asset, sourceRoot, sourceId, newNameRaw });
  if (!pre.canRenameNow) {
    const reason =
      pre.conflicts[0]?.message ??
      pre.warnings.find((w) =>
        ["SHARED_ACROSS_SOURCES", "NOT_GIT_REPO", "DIRTY_WORKING_TREE"].includes(w.code),
      )?.message ??
      "Rename blocked.";
    throw new RenameError("PRECONDITION_FAILED", reason);
  }

  if (!(await isGitRepo(sourceRoot))) {
    throw new RenameError("NOT_GIT_REPO", "Source is not a git repository.");
  }

  const oldAbsPath = asset.absPath;
  const newRelPath = pre.newRelPath;
  const newAbsPath = pre.newAbsPath;
  const newName = pre.newName;
  const newStem = stripExt(newName, asset.ext);

  const selected =
    acceptedUsageIds === "all"
      ? pre.affectedUsages
      : pre.affectedUsages.filter((u) => acceptedUsageIds.includes(u.id));

  const usageRelPaths = Array.from(new Set(selected.map((u) => u.relPath)));
  const affectedRelPaths = Array.from(new Set([asset.relPath, ...usageRelPaths]));

  const dirty = await statusPorcelain(sourceRoot, affectedRelPaths);
  if (!dirty.ok || dirty.stdout.trim().length > 0) {
    throw new RenameError(
      "DIRTY_WORKING_TREE",
      "Working tree dirtied between preflight and execute. Aborting.",
    );
  }

  const fileEdits = groupByFile(selected, asset.name, newName);
  const editedFiles: string[] = [];
  const staleRefs: StaleRef[] = [];
  const updatedSnippets = new Map<number, string>();
  let movedFile = false;

  const rollback = async (): Promise<void> => {
    const toCheckout = [...editedFiles];
    if (movedFile) {
      try {
        await rename(newAbsPath, oldAbsPath);
      } catch {}
      toCheckout.push(asset.relPath, newRelPath);
    }
    if (toCheckout.length > 0) {
      await gitResetPaths(sourceRoot, toCheckout);
      await gitCheckoutPaths(sourceRoot, toCheckout);
    }
  };

  try {
    for (const [relPath, group] of fileEdits) {
      const absFile = resolve(sourceRoot, relPath);
      const source = await readFile(absFile, "utf8");
      const lines = source.split("\n");
      const needleLc = asset.name.toLowerCase();
      let changed = false;

      for (const u of group) {
        const lineIdx = u.line - 1;
        const original = lines[lineIdx];
        if (original === undefined) {
          staleRefs.push({ usageId: u.id, relPath, line: u.line });
          continue;
        }
        const hitIdx = original.toLowerCase().indexOf(needleLc);
        if (hitIdx < 0) {
          staleRefs.push({ usageId: u.id, relPath, line: u.line });
          continue;
        }
        const replaced =
          original.slice(0, hitIdx) + newName + original.slice(hitIdx + asset.name.length);
        lines[lineIdx] = replaced;
        updatedSnippets.set(u.id, replaced.slice(0, 200));
        changed = true;
      }

      if (changed) {
        await writeFile(absFile, lines.join("\n"), "utf8");
        editedFiles.push(relPath);
      }
    }

    if (staleRefs.length > 0 && !skipStale) {
      await rollback();
      throw new RenameError(
        "STALE_REFERENCES",
        `${staleRefs.length} reference${staleRefs.length === 1 ? " does" : "s do"} not match the index. Re-run index or opt into skipping stale references.`,
      );
    }

    const mv = await gitMove(sourceRoot, asset.relPath, newRelPath);
    if (!mv.ok) {
      await rollback();
      throw new RenameError("GIT_MV_FAILED", mv.stderr.trim() || "git mv failed.");
    }
    movedFile = true;

    const add = await gitAdd(sourceRoot, editedFiles);
    if (!add.ok) {
      await rollback();
      throw new RenameError("GIT_ADD_FAILED", add.stderr.trim() || "git add failed.");
    }

    const message = `rename: ${asset.relPath} → ${newRelPath}`;
    const commit = await gitCommit(sourceRoot, message);
    if (!commit.ok) {
      await rollback();
      throw new RenameError(
        "GIT_COMMIT_FAILED",
        commit.stderr.trim() || "git commit failed (hook rejection or empty commit).",
      );
    }

    const commitSha = await headSha(sourceRoot);

    db.transaction((tx) => {
      tx.update(assets)
        .set({ absPath: newAbsPath, relPath: newRelPath, name: newName, stem: newStem })
        .where(eq(assets.id, asset.id))
        .run();
      for (const [usageId, snippet] of updatedSnippets) {
        tx.update(usages).set({ snippet }).where(eq(usages.id, usageId)).run();
      }
    });

    return {
      assetId: asset.id,
      newRelPath,
      newAbsPath,
      newName,
      updatedUsageCount: updatedSnippets.size,
      commitSha,
      staleRefs,
      affectedRelPaths,
    };
  } catch (err) {
    if (err instanceof RenameError) throw err;
    await rollback();
    const message = err instanceof Error ? err.message : String(err);
    throw new RenameError("UNEXPECTED", message);
  }
}

function groupByFile(
  rows: { id: number; relPath: string; line: number }[],
  _oldName: string,
  _newName: string,
): Map<string, { id: number; line: number }[]> {
  const out = new Map<string, { id: number; line: number }[]>();
  for (const r of rows) {
    const bucket = out.get(r.relPath) ?? [];
    bucket.push({ id: r.id, line: r.line });
    out.set(r.relPath, bucket);
  }
  for (const bucket of out.values()) {
    bucket.sort((a, b) => a.line - b.line);
  }
  return out;
}

function stripExt(name: string, ext: string): string {
  const suffix = `.${ext.toLowerCase()}`;
  if (name.toLowerCase().endsWith(suffix)) return name.slice(0, name.length - suffix.length);
  return name;
}

export class RenameError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "RenameError";
  }
}

export function buildNewRelPath(oldRelPath: string, newName: string): string {
  const dir = posix.dirname(oldRelPath);
  if (!dir || dir === ".") return newName;
  return posix.join(dir, newName);
}

export function deriveNewName(oldAbsPath: string, newName: string): { dir: string; abs: string } {
  return { dir: dirname(oldAbsPath), abs: resolve(dirname(oldAbsPath), basename(newName)) };
}
