import { access, stat } from "node:fs/promises";
import { platform } from "node:os";
import { posix, resolve, sep } from "node:path";
import { and, eq, ne } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { listAssetUsages, type UsageRow } from "@/lib/db/queries/asset-detail";
import { type Asset, assets, sources } from "@/lib/db/schema";
import { isGitRepo, statusPorcelain } from "./git";

export type ConflictCode =
  | "EMPTY_NAME"
  | "ILLEGAL_CHAR"
  | "RESERVED_NAME"
  | "NAME_TOO_LONG"
  | "EXTENSION_CHANGED"
  | "TARGET_EXISTS_DISK"
  | "TARGET_EXISTS_DB"
  | "TRAVERSAL"
  | "CASE_ONLY_APFS"
  | "SAME_NAME";

export type WarningCode =
  | "SHARED_ACROSS_SOURCES"
  | "AMBIGUOUS_FILENAME"
  | "NOT_GIT_REPO"
  | "DIRTY_WORKING_TREE"
  | "UNWRITABLE_FILES";

export type TipCode =
  | "CONTAINS_SPACE"
  | "UPPERCASE"
  | "MIXED_SEPARATORS"
  | "DOUBLE_SEPARATOR"
  | "NON_ASCII"
  | "LEADING_PUNCT"
  | "TRAILING_PUNCT";

export type Conflict = { code: ConflictCode; message: string };
export type Warning = { code: WarningCode; message: string; detail?: string };
export type Tip = { code: TipCode; message: string };

export type AffectedUsage = UsageRow & { external: boolean };

export type PreflightResult = {
  ok: boolean;
  conflicts: Conflict[];
  warnings: Warning[];
  tips: Tip[];
  affectedUsages: AffectedUsage[];
  newName: string;
  newRelPath: string;
  newAbsPath: string;
  canRenameNow: boolean;
};

const ILLEGAL_CHARS = /[<>:"|?*]/;
const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
const MAX_NAME_BYTES = 255;
const USAGE_FETCH_LIMIT = 10_000;

function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) < 0x20) return true;
  }
  return false;
}

function hasNonAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) return true;
  }
  return false;
}

export type ValidateInput = {
  db: Db;
  asset: Asset;
  sourceRoot: string;
  sourceId: number;
  newNameRaw: string;
};

export async function validateRename(input: ValidateInput): Promise<PreflightResult> {
  const { db, asset, sourceRoot, sourceId, newNameRaw } = input;
  const conflicts: Conflict[] = [];
  const warnings: Warning[] = [];
  const tips: Tip[] = [];

  const newName = newNameRaw.trim();
  const oldDir = asset.dir;
  const newRelPath = oldDir ? posix.join(oldDir, newName) : newName;
  const newAbsPath = resolve(sourceRoot, newRelPath);

  if (!newName) {
    conflicts.push({ code: "EMPTY_NAME", message: "Name cannot be empty." });
  }

  if (newName && (ILLEGAL_CHARS.test(newName) || hasControlChar(newName))) {
    conflicts.push({
      code: "ILLEGAL_CHAR",
      message: 'Name contains illegal characters (< > : " | ? * or control chars).',
    });
  }

  if (newName && newName.includes("/")) {
    conflicts.push({
      code: "ILLEGAL_CHAR",
      message: "Name cannot contain path separators.",
    });
  }

  if (newName && WINDOWS_RESERVED.test(newName)) {
    conflicts.push({ code: "RESERVED_NAME", message: `"${newName}" is a reserved filename.` });
  }

  if (newName && Buffer.byteLength(newName, "utf8") > MAX_NAME_BYTES) {
    conflicts.push({ code: "NAME_TOO_LONG", message: `Name exceeds ${MAX_NAME_BYTES} bytes.` });
  }

  if (newName && !newName.toLowerCase().endsWith(`.${asset.ext.toLowerCase()}`)) {
    conflicts.push({
      code: "EXTENSION_CHANGED",
      message: `Extension must stay ".${asset.ext}".`,
    });
  }

  if (newName === asset.name) {
    conflicts.push({ code: "SAME_NAME", message: "New name is the same as the current name." });
  }

  if (
    newName &&
    newName !== asset.name &&
    newName.toLowerCase() === asset.name.toLowerCase() &&
    isCaseInsensitiveFs()
  ) {
    conflicts.push({
      code: "CASE_ONLY_APFS",
      message: "Case-only rename is not supported on this filesystem. Use a different spelling.",
    });
  }

  const rootWithSep = sourceRoot.endsWith(sep) ? sourceRoot : sourceRoot + sep;
  if (!newAbsPath.startsWith(rootWithSep)) {
    conflicts.push({
      code: "TRAVERSAL",
      message: "Resolved path escapes the source root.",
    });
  }

  if (
    conflicts.length === 0 ||
    !conflicts.some((c) => c.code === "EMPTY_NAME" || c.code === "ILLEGAL_CHAR")
  ) {
    try {
      await access(newAbsPath);
      conflicts.push({
        code: "TARGET_EXISTS_DISK",
        message: `A file already exists at ${newRelPath}.`,
      });
    } catch {}

    const [collision] = db
      .select({ id: assets.id })
      .from(assets)
      .where(
        and(eq(assets.sourceId, sourceId), eq(assets.absPath, newAbsPath), ne(assets.id, asset.id)),
      )
      .all();
    if (collision) {
      conflicts.push({
        code: "TARGET_EXISTS_DB",
        message: `Another asset at ${newRelPath} is already indexed.`,
      });
    }
  }

  if (newName && conflicts.length === 0) {
    const stem = newName.slice(0, Math.max(0, newName.length - (asset.ext.length + 1)));
    if (/\s/.test(stem)) {
      tips.push({
        code: "CONTAINS_SPACE",
        message: "Filename has whitespace. Consider dashes or underscores instead.",
      });
    }
    if (/[A-Z]/.test(stem) && /[a-z]/.test(stem)) {
      tips.push({
        code: "UPPERCASE",
        message: "Mixed case. Most asset filenames are all-lowercase for portability.",
      });
    }
    if (/-/.test(stem) && /_/.test(stem)) {
      tips.push({
        code: "MIXED_SEPARATORS",
        message: "Mixes - and _. Pick one separator for consistency.",
      });
    }
    if (/--|__/.test(stem)) {
      tips.push({
        code: "DOUBLE_SEPARATOR",
        message: "Double separator (`--` or `__`). Probably a typo.",
      });
    }
    if (hasNonAscii(stem)) {
      tips.push({
        code: "NON_ASCII",
        message: "Non-ASCII characters may render inconsistently across tools.",
      });
    }
    if (stem && /^[._-]/.test(stem)) {
      tips.push({
        code: "LEADING_PUNCT",
        message: "Starts with punctuation. Unusual for asset names.",
      });
    }
    if (stem && /[._-]$/.test(stem)) {
      tips.push({
        code: "TRAILING_PUNCT",
        message: "Ends with punctuation before the extension.",
      });
    }
  }

  const sharedCount = countSourcesContainingPath(db, asset.absPath, sourceId);
  if (sharedCount > 0) {
    warnings.push({
      code: "SHARED_ACROSS_SOURCES",
      message: "This asset is inside another indexed source root.",
      detail: `${sharedCount + 1} sources contain this path. Use plan-based rename to handle the other sources deliberately.`,
    });
  }

  const ambiguous = db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.name, asset.name), ne(assets.id, asset.id)))
    .limit(1)
    .all();
  if (ambiguous.length > 0) {
    warnings.push({
      code: "AMBIGUOUS_FILENAME",
      message: `Another asset in the index has the filename "${asset.name}".`,
      detail:
        "References matching by filename alone may belong to the other asset — review the list before renaming.",
    });
  }

  const affectedUsages = listAssetUsages(db, asset.id, null, USAGE_FETCH_LIMIT).map((u) => ({
    ...u,
    external: u.absPath !== "" && !u.absPath.startsWith(rootWithSep),
  }));
  // git status only understands paths inside the repo; external refs are
  // reported, never edited, so they don't gate the rename
  const affectedRelPaths = Array.from(
    new Set([asset.relPath, ...affectedUsages.filter((u) => !u.external).map((u) => u.relPath)]),
  );

  const repo = await isGitRepo(sourceRoot);
  if (!repo) {
    warnings.push({
      code: "NOT_GIT_REPO",
      message: "Source is not a git repository. In-process rename is disabled.",
    });
  } else {
    const dirty = await statusPorcelain(sourceRoot, affectedRelPaths);
    if (dirty.ok && dirty.stdout.trim().length > 0) {
      warnings.push({
        code: "DIRTY_WORKING_TREE",
        message: "Uncommitted changes touch the asset or one of its references.",
        detail: "Commit or stash those changes before using Rename now.",
      });
    }
  }

  const ok = conflicts.length === 0;
  const blocksM2 = warnings.some(
    (w) =>
      w.code === "SHARED_ACROSS_SOURCES" ||
      w.code === "NOT_GIT_REPO" ||
      w.code === "DIRTY_WORKING_TREE" ||
      w.code === "UNWRITABLE_FILES",
  );
  const canRenameNow = ok && !blocksM2;

  return {
    ok,
    conflicts,
    warnings,
    tips,
    affectedUsages,
    newName,
    newRelPath,
    newAbsPath,
    canRenameNow,
  };
}

function isCaseInsensitiveFs(): boolean {
  const p = platform();
  return p === "darwin" || p === "win32";
}

function countSourcesContainingPath(db: Db, absPath: string, excludeSourceId: number): number {
  const rows = db.select({ root: sources.root, id: sources.id }).from(sources).all();
  let count = 0;
  for (const r of rows) {
    if (r.id === excludeSourceId) continue;
    const rootWithSep = r.root.endsWith(sep) ? r.root : r.root + sep;
    if (absPath.startsWith(rootWithSep)) count += 1;
  }
  return count;
}

export async function ensureFilesWritable(paths: string[]): Promise<string[]> {
  const bad: string[] = [];
  for (const p of paths) {
    try {
      const s = await stat(p);
      if (!s.isFile()) bad.push(p);
    } catch {
      bad.push(p);
    }
  }
  return bad;
}
