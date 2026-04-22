"use client";

import type { GroupMember } from "@/lib/db/queries/groups";

const CHECKER = {
  backgroundImage:
    "linear-gradient(45deg, var(--color-checker-b) 25%, transparent 25%), linear-gradient(-45deg, var(--color-checker-b) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--color-checker-b) 75%), linear-gradient(-45deg, transparent 75%, var(--color-checker-b) 75%)",
  backgroundSize: "10px 10px",
  backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0",
  backgroundColor: "var(--color-checker-a)",
};

const SELECTED_SHADOW =
  "inset 0 0 0 2px var(--color-accent), 0 8px 20px -10px rgba(59, 108, 216, 0.4)";

type Props = {
  member: GroupMember;
  selected: boolean;
  onClick: () => void;
};

export function VariantTile({ member, selected, onClick }: Props) {
  return (
    <button
      type="button"
      data-asset-tile="true"
      onClick={onClick}
      style={selected ? { boxShadow: SELECTED_SHADOW } : undefined}
      className={`relative flex h-18 w-18 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xs border border-border transition-[box-shadow,border-color,transform] duration-150 ease-out active:scale-[0.97] hover:border-border-2 ${
        selected ? "z-10 border-transparent" : ""
      }`}
      title={member.name}
    >
      <div className="absolute inset-0" style={CHECKER} />
      {/** biome-ignore lint/performance/noImgElement: local preview */}
      <img
        src={`/api/preview/${member.assetId}`}
        alt={member.name}
        loading="lazy"
        draggable={false}
        className="relative max-h-[70%] max-w-[70%] select-none"
      />
      {member.role === "canonical" ? (
        <span className="absolute left-0.5 top-0.5 rounded-xs bg-ok-bg px-1 py-px font-mono text-3xs font-semibold text-ok">
          CANON
        </span>
      ) : null}
    </button>
  );
}
