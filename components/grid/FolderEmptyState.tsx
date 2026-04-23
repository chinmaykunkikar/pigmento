"use client";

import { useMemo } from "react";
import type { TreeNode } from "@/lib/db/queries/folders";
import { useTree } from "@/lib/queries/tree";
import { useExplorerStore } from "@/lib/store";
import { ChevronRight, Folder, FolderOpen, Search, X } from "../icons";

type Props = {
  sourceId: number;
  folderPath: string;
  filterActive: boolean;
};

export function FolderEmptyState({ sourceId, folderPath, filterActive }: Props) {
  const tree = useTree(sourceId);
  const setSelectedFolder = useExplorerStore((s) => s.setSelectedFolder);
  const clearFilters = useExplorerStore((s) => s.clearFilters);

  const node = useMemo(
    () => (tree.data ? findNode(tree.data, folderPath) : null),
    [tree.data, folderPath],
  );
  const suggestions = useMemo(
    () => (node ? collectLeafFolders(node, folderPath) : []),
    [node, folderPath],
  );

  if (filterActive) {
    return (
      <Shell
        icon={<Search size={22} strokeWidth={1.5} className="text-text-3" />}
        title="No matches in this folder"
        hint="Nothing here matches your current filters."
        action={{
          label: "Clear filters",
          icon: <X size={11} strokeWidth={2} />,
          onClick: clearFilters,
        }}
      />
    );
  }

  if (suggestions.length > 0) {
    const total = suggestions.reduce((n, s) => n + s.count, 0);
    const assetWord = total === 1 ? "asset lives" : "assets live";
    const folderWord = suggestions.length === 1 ? "folder" : "folders";
    return (
      <Shell
        icon={<FolderOpen size={22} strokeWidth={1.5} className="text-text-3" />}
        title="Nothing in this folder directly"
        hint={`${total.toLocaleString()} ${assetWord} under ${suggestions.length} ${folderWord} below. Jump straight in:`}
      >
        <div className="flex flex-col gap-1">
          {suggestions.map((s) => (
            <button
              type="button"
              key={s.path}
              onClick={() => setSelectedFolder(s.path)}
              className="group flex items-center gap-2 rounded-sm border border-border bg-surface px-2.5 py-1.5 text-left transition-colors hover:border-border-2 hover:bg-hover"
            >
              <Folder
                size={13}
                strokeWidth={1.5}
                className="flex-shrink-0 text-text-3 group-hover:text-text-2"
              />
              <span
                className="min-w-0 flex-1 truncate text-left font-mono text-xs text-text"
                title={s.path}
              >
                {s.relPath}
              </span>
              <span className="flex-shrink-0 font-mono text-2xs text-text-3 tabular-nums">
                {s.count.toLocaleString()}
              </span>
              <ChevronRight
                size={11}
                strokeWidth={1.75}
                className="flex-shrink-0 text-text-4 group-hover:text-text-3"
              />
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      icon={<FolderOpen size={22} strokeWidth={1.5} className="text-text-3" />}
      title="Empty folder"
      hint="No assets indexed under this path. Re-index if you've added files since the last scan."
      action={
        folderPath
          ? {
              label: "Back to source root",
              icon: <ChevronRight size={11} strokeWidth={2} className="rotate-180" />,
              onClick: () => setSelectedFolder(""),
            }
          : undefined
      }
    />
  );
}

type ShellAction = {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
};

function Shell({
  icon,
  title,
  hint,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  action?: ShellAction;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-bg p-6">
      <div className="flex w-full max-w-120 flex-col items-center gap-3 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-sm border border-border bg-surface">
          {icon}
        </span>
        <div className="flex flex-col gap-1">
          <div className="font-sans text-sm font-semibold text-text">{title}</div>
          <div className="font-sans text-xs text-text-3">{hint}</div>
        </div>
        {children ? <div className="mt-1 w-full">{children}</div> : null}
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-1 inline-flex h-7 items-center gap-1.5 rounded-sm border border-border bg-surface px-2.5 font-sans text-xs font-medium text-text-2 transition-colors hover:border-border-2 hover:bg-hover hover:text-text"
          >
            {action.icon}
            {action.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function findNode(root: TreeNode, path: string): TreeNode | null {
  if (path === "" || path === "/") return root;
  const parts = path.split("/").filter(Boolean);
  let cur: TreeNode | undefined = root;
  for (const p of parts) {
    cur = cur?.children.find((c) => c.name === p);
    if (!cur) return null;
  }
  return cur ?? null;
}

type Suggestion = { path: string; relPath: string; count: number };
const SUGGESTION_LIMIT = 12;

function collectLeafFolders(node: TreeNode, base: string): Suggestion[] {
  const basePrefix = base ? `${base}/` : "";
  const out: Suggestion[] = [];
  const walk = (n: TreeNode) => {
    const direct = directCount(n);
    if (direct > 0) {
      const relPath =
        n.path === base
          ? "."
          : basePrefix && n.path.startsWith(basePrefix)
            ? n.path.slice(basePrefix.length)
            : n.path;
      out.push({ path: n.path, relPath: relPath || n.name || ".", count: direct });
    }
    for (const c of n.children) walk(c);
  };
  walk(node);
  out.sort((a, b) => b.count - a.count || a.relPath.localeCompare(b.relPath));
  return out.slice(0, SUGGESTION_LIMIT);
}

function directCount(n: TreeNode): number {
  const sub = n.children.reduce((acc, c) => acc + c.count, 0);
  return Math.max(0, n.count - sub);
}
