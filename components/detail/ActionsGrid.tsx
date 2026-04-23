"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { Asset } from "@/lib/db/schema";
import { Check, ChevronDown, Copy, Download } from "../icons";
import { IconBtn } from "../primitives/IconBtn";
import { formatCombo, KbdHint } from "../primitives/KbdHint";

type Props = { asset: Asset };

type CopyKey = "path" | "import";

export function ActionsGrid({ asset }: Props) {
  const [justCopied, setJustCopied] = useState<CopyKey | null>(null);

  const copy = async (key: CopyKey, text: string) => {
    await navigator.clipboard.writeText(text);
    setJustCopied(key);
    setTimeout(() => setJustCopied(null), 1200);
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = `/api/preview/${asset.id}`;
    a.download = asset.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const importStatement = buildImport(asset);

  const triggerLabel =
    justCopied === "path" ? "Copied path" : justCopied === "import" ? "Copied import" : "Copy";

  return (
    <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-7 flex-1 items-center gap-1.5 rounded-sm border px-2 font-sans text-xs font-medium transition-colors duration-200 hover:bg-hover aria-expanded:bg-hover",
              justCopied
                ? "animate-[slide-down-in_200ms_var(--ease-out-quart)] border-ok bg-ok-bg text-ok"
                : "border-border bg-surface text-text-2",
            )}
          >
            <span className="relative inline-flex h-3 w-3 flex-shrink-0 items-center justify-center">
              <Copy
                size={12}
                strokeWidth={1.5}
                className={cn(
                  "absolute transition-opacity duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
                  justCopied ? "opacity-0" : "opacity-100",
                )}
              />
              <Check
                size={12}
                strokeWidth={2.25}
                className={cn(
                  "absolute transition-opacity duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
                  justCopied ? "opacity-100" : "opacity-0",
                )}
              />
            </span>
            <span className="flex-1 text-left">{triggerLabel}</span>
            <ChevronDown
              size={11}
              strokeWidth={1.75}
              className={cn(justCopied ? "text-ok/60" : "text-text-3")}
            />
          </button>
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content
            align="start"
            sideOffset={4}
            className="z-50 w-(--radix-dropdown-menu-trigger-width) overflow-hidden rounded-md border border-border bg-surface p-0.5 data-[state=open]:animate-[fade-in_120ms_var(--ease-out-quart)]"
          >
            <Dropdown.Item
              onSelect={() => copy("path", asset.relPath)}
              className="flex h-7 items-center gap-2 rounded-xs px-2 font-sans text-xs text-text outline-none data-[highlighted]:bg-accent-bg data-[highlighted]:text-accent-text"
            >
              <Copy size={11} strokeWidth={1.5} className="flex-shrink-0 text-text-3" />
              <span className="flex-1">Copy path</span>
              <KbdHint keys={formatCombo("mod+c")} />
            </Dropdown.Item>
            <Dropdown.Item
              onSelect={() => copy("import", importStatement)}
              className="flex h-7 items-center gap-2 rounded-xs px-2 font-sans text-xs text-text outline-none data-[highlighted]:bg-accent-bg data-[highlighted]:text-accent-text"
            >
              <Copy size={11} strokeWidth={1.5} className="flex-shrink-0 text-text-3" />
              <span className="flex-1">Copy import</span>
              <KbdHint keys={formatCombo("mod+shift+c")} />
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
      <IconBtn label="Download" onClick={download}>
        <Download size={12} strokeWidth={1.5} />
      </IconBtn>
    </div>
  );
}

function buildImport(asset: Asset): string {
  const id = asset.stem.replace(/[^a-zA-Z0-9_$]/g, "_") || "asset";
  if (asset.ext === "svg") return `import ${id} from "./${asset.relPath}?react";`;
  return `import ${id} from "./${asset.relPath}";`;
}
