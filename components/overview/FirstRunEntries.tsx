"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { useAddSource } from "@/lib/queries/sources";
import { Check, Copy, FolderPlus } from "../icons";
import { Button } from "../primitives/Button";

const CLI_CMD = "npx pigmento source add /path/to/repo";

export function FirstRunEntries({ onAdded }: { onAdded: (id: number) => void }) {
  const [root, setRoot] = useState("");
  const [label, setLabel] = useState("");
  const [copied, setCopied] = useState(false);
  const add = useAddSource();

  async function submit() {
    if (!root.trim()) return;
    try {
      const source = await add.mutateAsync({ root: root.trim(), label: label.trim() || undefined });
      onAdded(source.id);
      setRoot("");
      setLabel("");
    } catch {
      /* surfaced via add.error */
    }
  }

  function onDirectoryPicked(e: ChangeEvent<HTMLInputElement>) {
    const first = e.target.files?.[0];
    if (!first) return;
    const rel = first.webkitRelativePath.split("/")[0];
    if (rel && !label) setLabel(rel);
  }

  async function copyCli() {
    try {
      await navigator.clipboard.writeText(CLI_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the command is visible to copy by hand */
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={root}
          onChange={(e) => setRoot(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="/Users/you/workspace/my-repo"
          className="h-8 min-w-0 flex-1 rounded-sm border border-border bg-sunken px-2.5 font-mono text-sm text-text outline-none placeholder:text-text-4 focus:border-accent/40"
        />
        <Button
          variant="primary"
          className="h-8 px-3.5"
          onClick={submit}
          disabled={!root.trim() || add.isPending}
        >
          {add.isPending ? "Indexing…" : "Add + Index"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs text-text-3">
        <label
          htmlFor="fr-dir"
          className="inline-flex cursor-pointer items-center gap-1.5 hover:text-text-2"
        >
          <FolderPlus size={12} strokeWidth={1.5} />
          pick a folder to fill the label
          <input
            id="fr-dir"
            type="file"
            className="hidden"
            onChange={onDirectoryPicked}
            ref={(el) => {
              if (el) el.setAttribute("webkitdirectory", "");
            }}
          />
        </label>
        {label ? <span className="text-text-2">label: {label}</span> : null}
      </div>

      <div className="flex items-center gap-2 rounded-sm border border-border bg-sunken px-2.5 py-1.5">
        <span className="font-mono text-xs text-text-4">$</span>
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-text-2">{CLI_CMD}</code>
        <button
          type="button"
          onClick={copyCli}
          aria-label="Copy CLI command"
          className="flex-shrink-0 rounded-xs p-1 text-text-3 transition-colors hover:bg-hover hover:text-text-2"
        >
          {copied ? <Check size={12} strokeWidth={1.75} /> : <Copy size={12} strokeWidth={1.5} />}
        </button>
      </div>

      {add.isError ? (
        <div className="rounded-sm border border-danger/30 bg-danger-bg px-2.5 py-1.5 font-mono text-xs text-danger">
          {(add.error as Error).message}
        </div>
      ) : null}
    </div>
  );
}
