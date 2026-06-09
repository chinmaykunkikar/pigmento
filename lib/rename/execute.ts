import { readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, posix, resolve, sep } from "node:path";
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

export type SkippedExternalRef = { usageId: number; absPath: string; line: number };

export type ExecuteResult = {
  assetId: number;
  newRelPath: string;
  newAbsPath: string;
  newName: string;
  updatedUsageCount: number;
  commitSha: string | null;
  staleRefs: StaleRef[];
  skippedExternal: SkippedExternalRef[];
  indexStale: boolean;
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

  const selectedAll =
    acceptedUsageIds === "all"
      ? pre.affectedUsages
      : pre.affectedUsages.filter((u) => acceptedUsageIds.includes(u.id));

  // references outside the source root are never edited and never block the
  // rename; they are reported so the caller can surface them as stale
  const rootWithSep = sourceRoot.endsWith(sep) ? sourceRoot : sourceRoot + sep;
  const isExternal = (absPath: string) => absPath !== "" && !absPath.startsWith(rootWithSep);
  const selected = selectedAll.filter((u) => !isExternal(u.absPath));
  const skippedExternal: SkippedExternalRef[] = selectedAll
    .filter((u) => isExternal(u.absPath))
    .map((u) => ({ usageId: u.id, absPath: u.absPath, line: u.line }));

  const usageRelPaths = Array.from(new Set(selected.map((u) => u.relPath)));
  const affectedRelPaths = Array.from(new Set([asset.relPath, ...usageRelPaths]));

  const dirty = await statusPorcelain(sourceRoot, affectedRelPaths);
  if (!dirty.ok || dirty.stdout.trim().length > 0) {
    throw new RenameError(
      "DIRTY_WORKING_TREE",
      "Working tree dirtied between preflight and execute. Aborting.",
    );
  }

  const fileEdits = groupByFile(selected);
  const editedFiles: string[] = [];
  const staleRefs: StaleRef[] = [];
  const updatedSnippets = new Map<number, string>();
  let movedFile = false;

  const rollback = async (): Promise<string[]> => {
    const problems: string[] = [];
    const toCheckout = [...editedFiles];
    if (movedFile) {
      try {
        await rename(newAbsPath, oldAbsPath);
      } catch (err) {
        problems.push(
          `failed to move ${newRelPath} back: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      toCheckout.push(asset.relPath, newRelPath);
    }
    if (toCheckout.length > 0) {
      const reset = await gitResetPaths(sourceRoot, toCheckout);
      if (!reset.ok) problems.push(`git reset failed: ${reset.stderr.trim()}`);
      const checkout = await gitCheckoutPaths(sourceRoot, toCheckout);
      if (!checkout.ok) problems.push(`git checkout failed: ${checkout.stderr.trim()}`);
    }
    return problems;
  };

  const rollbackOrReport = async (base: RenameError): Promise<RenameError> => {
    const problems = await rollback();
    if (problems.length === 0) return base;
    return new RenameError(
      base.code,
      `${base.message} Rollback was incomplete: ${problems.join("; ")}. Inspect the working tree before retrying.`,
    );
  };

  try {
    for (const [relPath, group] of fileEdits) {
      const absFile = group.absPath !== "" ? group.absPath : resolve(sourceRoot, relPath);
      const source = await readFile(absFile, "utf8");
      const lines = source.split("\n");
      const needleLc = asset.name.toLowerCase();
      let changed = false;

      for (const u of group.rows) {
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
      throw await rollbackOrReport(
        new RenameError(
          "STALE_REFERENCES",
          `${staleRefs.length} reference${staleRefs.length === 1 ? " does" : "s do"} not match the index. Re-run index or opt into skipping stale references.`,
        ),
      );
    }

    const mv = await gitMove(sourceRoot, asset.relPath, newRelPath);
    if (!mv.ok) {
      throw await rollbackOrReport(
        new RenameError("GIT_MV_FAILED", mv.stderr.trim() || "git mv failed."),
      );
    }
    movedFile = true;

    const add = await gitAdd(sourceRoot, editedFiles);
    if (!add.ok) {
      throw await rollbackOrReport(
        new RenameError("GIT_ADD_FAILED", add.stderr.trim() || "git add failed."),
      );
    }

    const message = `rename: ${asset.relPath} → ${newRelPath}`;
    const commit = await gitCommit(sourceRoot, message);
    if (!commit.ok) {
      throw await rollbackOrReport(
        new RenameError(
          "GIT_COMMIT_FAILED",
          commit.stderr.trim() || "git commit failed (hook rejection or empty commit).",
        ),
      );
    }

    const commitSha = await headSha(sourceRoot);

    // the commit is the point of no return: a failure past here must never
    // roll back files, or repo HEAD and the working tree diverge silently
    let indexStale = false;
    try {
      db.transaction((tx) => {
        tx.update(assets)
          .set({ absPath: newAbsPath, relPath: newRelPath, name: newName, stem: newStem })
          .where(eq(assets.id, asset.id))
          .run();
        for (const [usageId, snippet] of updatedSnippets) {
          tx.update(usages).set({ snippet }).where(eq(usages.id, usageId)).run();
        }
      });
    } catch {
      indexStale = true;
    }

    return {
      assetId: asset.id,
      newRelPath,
      newAbsPath,
      newName,
      updatedUsageCount: updatedSnippets.size,
      commitSha,
      staleRefs,
      skippedExternal,
      indexStale,
      affectedRelPaths,
    };
  } catch (err) {
    if (err instanceof RenameError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw await rollbackOrReport(new RenameError("UNEXPECTED", message));
  }
}

type FileEditGroup = { absPath: string; rows: { id: number; line: number }[] };

function groupByFile(rows: { id: number; relPath: string; absPath: string; line: number }[]) {
  const out = new Map<string, FileEditGroup>();
  for (const r of rows) {
    const bucket = out.get(r.relPath) ?? { absPath: r.absPath, rows: [] };
    bucket.rows.push({ id: r.id, line: r.line });
    out.set(r.relPath, bucket);
  }
  for (const bucket of out.values()) {
    bucket.rows.sort((a, b) => a.line - b.line);
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
