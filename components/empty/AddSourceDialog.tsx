"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useAddSource } from "@/lib/queries/sources";
import { FolderPlus, X } from "../icons";
import { Button } from "../primitives/Button";
import { IconBtn } from "../primitives/IconBtn";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (sourceId: number) => void;
};

export function AddSourceDialog({ open, onOpenChange, onAdded }: Props) {
  const [root, setRoot] = useState("");
  const [label, setLabel] = useState("");
  const add = useAddSource();

  async function submit() {
    if (!root.trim()) return;
    try {
      const source = await add.mutateAsync({
        root: root.trim(),
        label: label.trim() || undefined,
      });
      onAdded?.(source.id);
      setRoot("");
      setLabel("");
      onOpenChange(false);
    } catch {
      /* error displayed from add.error */
    }
  }

  function onDirectoryPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const first = files[0];
    if (!first) return;
    const rel = first.webkitRelativePath.split("/")[0];
    if (rel && !label) setLabel(rel);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-[dialog-overlay-in_220ms_var(--ease-out-quart)] data-[state=closed]:animate-[dialog-overlay-out_160ms_var(--ease-out-quart)]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-110 rounded-md border border-border bg-surface shadow-[0_24px_48px_-24px_rgba(20,20,30,0.25)] [transform:translate(-50%,-50%)] data-[state=open]:animate-[dialog-content-in_220ms_var(--ease-out-quart)] data-[state=closed]:animate-[dialog-content-out_160ms_var(--ease-out-quart)]">
          <div className="flex h-9 items-center justify-between border-b border-border px-3">
            <Dialog.Title className="text-sm font-semibold text-text">
              Add local source
            </Dialog.Title>
            <Dialog.Close asChild>
              <IconBtn label="Close">
                <X size={14} strokeWidth={1.5} />
              </IconBtn>
            </Dialog.Close>
          </div>

          <div className="space-y-3 p-4">
            <label
              htmlFor="ae-root"
              className="block text-xs font-semibold uppercase tracking-wider text-text-3"
            >
              Absolute path
            </label>
            <input
              id="ae-root"
              placeholder="/Users/you/workspace/my-repo"
              value={root}
              onChange={(e) => setRoot(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              className="h-8 w-full rounded-sm border border-border bg-sunken px-2.5 font-mono text-sm text-text outline-none placeholder:text-text-4 focus:border-accent/40"
            />

            <label
              htmlFor="ae-label"
              className="block pt-1 text-xs font-semibold uppercase tracking-wider text-text-3"
            >
              Label (optional)
            </label>
            <input
              id="ae-label"
              placeholder="defaults to folder name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              className="h-8 w-full rounded-sm border border-border bg-sunken px-2.5 text-sm text-text outline-none placeholder:text-text-4 focus:border-accent/40"
            />

            <label
              htmlFor="ae-dir-picker"
              className="mt-2 flex h-16 cursor-pointer items-center justify-center rounded-sm border border-dashed border-border-2 bg-sunken/60 px-3 text-center text-xs text-text-3 hover:border-accent/40"
            >
              <FolderPlus size={14} strokeWidth={1.5} className="mr-2" />
              Pick a folder to auto-fill the label
              <input
                id="ae-dir-picker"
                type="file"
                className="hidden"
                onChange={onDirectoryPicked}
                ref={(el) => {
                  if (el) el.setAttribute("webkitdirectory", "");
                }}
              />
            </label>

            {add.isError ? (
              <div className="rounded-sm border border-danger/30 bg-danger-bg px-2.5 py-1.5 text-xs text-danger">
                {(add.error as Error).message}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
            <Dialog.Close asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.Close>
            <Button variant="primary" onClick={submit} disabled={!root.trim() || add.isPending}>
              {add.isPending ? "Indexing…" : "Add + Index"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
