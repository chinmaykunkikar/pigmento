"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { Asset } from "@/lib/db/schema";
import { Check, Copy, Download } from "../icons";

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

  return (
    <div className="flex gap-1.5 border-b border-border px-3 py-3">
      <ActionBtn
        label="Copy path"
        hint="⌘C"
        icon={
          justCopied === "path" ? (
            <Check size={12} strokeWidth={2} className="text-ok" />
          ) : (
            <Copy size={12} strokeWidth={1.5} />
          )
        }
        onClick={() => copy("path", asset.relPath)}
      />
      <ActionBtn
        label="Copy import"
        hint="⌘⇧C"
        icon={
          justCopied === "import" ? (
            <Check size={12} strokeWidth={2} className="text-ok" />
          ) : (
            <Copy size={12} strokeWidth={1.5} />
          )
        }
        onClick={() => copy("import", importStatement)}
      />
      <ActionBtn
        label="Download"
        icon={<Download size={12} strokeWidth={1.5} />}
        onClick={download}
      />
    </div>
  );
}

function buildImport(asset: Asset): string {
  const id = asset.stem.replace(/[^a-zA-Z0-9_$]/g, "_") || "asset";
  if (asset.ext === "svg") return `import ${id} from "./${asset.relPath}?react";`;
  return `import ${id} from "./${asset.relPath}";`;
}

function ActionBtn({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint ? `${label} (${hint})` : label}
      className="inline-flex h-7 flex-1 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-sm border border-border bg-surface px-2 font-sans text-xs font-medium text-text-2 transition-colors hover:border-border-2 hover:bg-hover hover:text-text"
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
