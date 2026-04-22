"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { TreeNode } from "@/lib/db/queries/folders";
import { ChevronDown, ChevronRight, Folder, FolderOpen } from "../icons";

type Props = {
  root: TreeNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
};

export function FolderTree({ root, selectedPath, onSelect }: Props) {
  const initialOpen = useMemo(() => {
    const s = new Set<string>([""]);
    for (const c of root.children) s.add(c.path);
    return s;
  }, [root]);
  const [open, setOpen] = useState<Set<string>>(initialOpen);

  function toggle(path: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <div className="py-1 text-sm">
      <TreeHeader label="FOLDERS" total={root.count} />
      <Row
        node={{ name: "/", path: "", count: root.count, children: [] }}
        depth={0}
        hasKids={root.children.length > 0}
        isOpen={true}
        selected={selectedPath === ""}
        onToggle={() => toggle("")}
        onSelect={() => onSelect("")}
      />
      {root.children.map((n) => (
        <Branch
          key={n.path}
          node={n}
          depth={1}
          open={open}
          onToggle={toggle}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function Branch({
  node,
  depth,
  open,
  onToggle,
  selectedPath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  open: Set<string>;
  onToggle: (path: string) => void;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const hasKids = node.children.length > 0;
  const isOpen = open.has(node.path);
  return (
    <>
      <Row
        node={node}
        depth={depth}
        hasKids={hasKids}
        isOpen={isOpen}
        selected={selectedPath === node.path}
        onToggle={() => onToggle(node.path)}
        onSelect={() => onSelect(node.path)}
      />
      {isOpen && hasKids
        ? node.children.map((c) => (
            <Branch
              key={c.path}
              node={c}
              depth={depth + 1}
              open={open}
              onToggle={onToggle}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))
        : null}
    </>
  );
}

function Row({
  node,
  depth,
  hasKids,
  isOpen,
  selected,
  onToggle,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  hasKids: boolean;
  isOpen: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex h-6 cursor-pointer items-center gap-1 border-l-2 pr-2.5 text-xs",
        selected
          ? "border-accent bg-accent-bg text-accent-text"
          : "border-transparent text-text hover:bg-hover",
      )}
      style={{ paddingLeft: `${6 + depth * 12}px` }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      role="treeitem"
      tabIndex={0}
      aria-selected={selected}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (hasKids) onToggle();
        }}
        className={cn(
          "flex h-4 w-3 items-center justify-center text-text-3",
          !hasKids && "opacity-0",
        )}
        tabIndex={-1}
      >
        {isOpen ? (
          <ChevronDown size={10} strokeWidth={1.5} />
        ) : (
          <ChevronRight size={10} strokeWidth={1.5} />
        )}
      </button>
      <span className={cn(selected ? "text-accent-text" : "text-text-3")}>
        {isOpen && hasKids ? (
          <FolderOpen size={13} strokeWidth={1.5} />
        ) : (
          <Folder size={13} strokeWidth={1.5} />
        )}
      </span>
      <span
        className={cn("flex-1 overflow-hidden truncate", selected ? "font-medium" : "font-normal")}
      >
        {node.name || "/"}
      </span>
      <span className="font-mono text-2xs tabular-nums text-text-4">{node.count}</span>
    </div>
  );
}

function TreeHeader({ label, total }: { label: string; total: number }) {
  return (
    <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wider text-text-3">
      <span>{label}</span>
      <span className="font-mono">{total}</span>
    </div>
  );
}
