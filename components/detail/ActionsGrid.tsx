"use client";

import type { ReactNode } from "react";
import type { Asset } from "@/lib/db/schema";
import {
  Archive,
  Copy,
  Download,
  ExternalLink,
  GitBranch,
  Pencil,
  Replace,
  Tag,
  Trash2,
} from "../icons";
import { Kbd } from "../primitives/Kbd";
import { Section } from "./Section";

type Props = { asset: Asset };

export function ActionsGrid({ asset }: Props) {
  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  function download() {
    const a = document.createElement("a");
    a.href = `/api/preview/${asset.id}`;
    a.download = asset.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const importStatement = buildImport(asset);

  return (
    <Section title="Actions">
      <div className="grid grid-cols-2 gap-1 px-3 pb-2.5 pt-0.5">
        <ActionBtn
          icon={<Copy size={12} strokeWidth={1.5} />}
          label="Copy path"
          kbd="⌘C"
          onClick={() => copy(asset.relPath)}
        />
        <ActionBtn
          icon={<Copy size={12} strokeWidth={1.5} />}
          label="Copy import"
          kbd="⌘⇧C"
          onClick={() => copy(importStatement)}
        />
        <ActionBtn
          icon={<Download size={12} strokeWidth={1.5} />}
          label="Download"
          onClick={download}
        />
        <ActionBtn
          icon={<ExternalLink size={12} strokeWidth={1.5} />}
          label="Reveal in Finder"
          disabled
        />
        <ActionBtn
          icon={<Pencil size={12} strokeWidth={1.5} />}
          label="Rename & refactor…"
          kbd="R"
          disabled
        />
        <ActionBtn
          icon={<GitBranch size={12} strokeWidth={1.5} />}
          label="Blame / git log"
          disabled
        />
        <ActionBtn icon={<Tag size={12} strokeWidth={1.5} />} label="Add tag…" disabled />
        <ActionBtn
          icon={<Replace size={12} strokeWidth={1.5} />}
          label="Replace across refs…"
          disabled
        />
      </div>
      <div className="flex gap-1 px-3 pb-3">
        <DangerBtn icon={<Trash2 size={12} strokeWidth={1.5} />} label="Delete (unused)" disabled />
        <DangerBtn icon={<Archive size={12} strokeWidth={1.5} />} label="Archive" disabled />
      </div>
    </Section>
  );
}

function buildImport(asset: Asset): string {
  const id = asset.stem.replace(/[^a-zA-Z0-9_$]/g, "_") || "asset";
  if (asset.ext === "svg") return `import ${id} from "./${asset.relPath}?react";`;
  return `import ${id} from "./${asset.relPath}";`;
}

type ActionProps = {
  icon: ReactNode;
  label: string;
  kbd?: string;
  disabled?: boolean;
  onClick?: () => void;
};

function ActionBtn({ icon, label, kbd, disabled, onClick }: ActionProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-xs border border-border bg-surface px-2 text-left text-[11.5px] font-medium text-text transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex-shrink-0 text-text-3">{icon}</span>
      <span className="flex-1 overflow-hidden text-ellipsis">{label}</span>
      {kbd ? <Kbd>{kbd}</Kbd> : null}
    </button>
  );
}

function DangerBtn({
  icon,
  label,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="inline-flex h-7 flex-1 items-center gap-1.5 rounded-xs border border-danger/30 bg-surface px-2 text-[11.5px] font-medium text-danger transition-colors hover:bg-danger-bg disabled:cursor-not-allowed disabled:border-border disabled:bg-sunken disabled:text-text-3"
    >
      <span className="flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
