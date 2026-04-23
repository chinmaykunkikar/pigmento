"use client";

import type { MouseEvent } from "react";
import { cn } from "@/lib/cn";
import type { GroupMember } from "@/lib/db/queries/groups";
import { SelectCheckbox } from "../primitives/SelectCheckbox";

const CHECKER = {
  backgroundImage:
    "linear-gradient(45deg, var(--color-checker-b) 25%, transparent 25%), linear-gradient(-45deg, var(--color-checker-b) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--color-checker-b) 75%), linear-gradient(-45deg, transparent 75%, var(--color-checker-b) 75%)",
  backgroundSize: "10px 10px",
  backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0",
  backgroundColor: "var(--color-checker-a)",
};

const SELECTED_SHADOW = "var(--shadow-variant-selected)";

type Props = {
  member: GroupMember;
  selected: boolean;
  inCart: boolean;
  cartActive: boolean;
  onClick: (e: MouseEvent) => void;
  onToggleCart: () => void;
};

export function VariantTile({
  member,
  selected,
  inCart,
  cartActive,
  onClick,
  onToggleCart,
}: Props) {
  const checkboxVisible = cartActive || inCart;
  return (
    <button
      type="button"
      data-asset-tile="true"
      onClick={onClick}
      style={selected ? { boxShadow: SELECTED_SHADOW } : undefined}
      className={cn(
        "group/variant relative flex h-18 w-18 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xs border border-border transition-[box-shadow,border-color,transform] duration-150 ease-out hover:border-border-2 active:scale-[0.97]",
        selected && "z-10 border-transparent",
        inCart && "border-accent/40",
      )}
      title={member.name}
    >
      <div className="absolute inset-0" style={CHECKER} />
      <div
        className={cn(
          "absolute left-1 top-1 z-10 transition-opacity duration-150",
          checkboxVisible
            ? "opacity-100"
            : "opacity-0 group-hover/variant:opacity-100 group-focus-within/variant:opacity-100",
        )}
      >
        <SelectCheckbox checked={inCart} onToggle={onToggleCart} label={member.name} size="sm" />
      </div>
      {/** biome-ignore lint/performance/noImgElement: local preview */}
      <img
        src={`/api/preview/${member.assetId}`}
        alt={member.name}
        loading="lazy"
        draggable={false}
        className="relative max-h-[70%] max-w-[70%] select-none"
      />
      {member.role === "canonical" ? (
        <span className="absolute bottom-0.5 right-0.5 rounded-xs bg-ok-bg px-1 py-px font-mono text-3xs font-semibold text-ok">
          CANON
        </span>
      ) : null}
    </button>
  );
}
