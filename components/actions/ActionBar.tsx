"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { ReviewGroupAction } from "@/lib/plan/schema";
import { fetchAssetRefs } from "@/lib/queries/assets";
import { useExplorerStore } from "@/lib/store";
import { Check, ClipboardList, X } from "../icons";

type Props = { sourceId: number; sourceLabel: string };

export function ActionBar({ sourceId, sourceLabel }: Props) {
  const cartIds = useExplorerStore((s) => s.cartIds);
  const clearCart = useExplorerStore((s) => s.clearCart);
  const addPlanAction = useExplorerStore((s) => s.addPlanAction);
  const setPlanDrawerOpen = useExplorerStore((s) => s.setPlanDrawerOpen);
  const [lastAdded, setLastAdded] = useState(false);

  const add = useMutation({
    mutationFn: async (ids: readonly number[]) => {
      const refs = await fetchAssetRefs(ids);
      const now = Date.now();
      const action: ReviewGroupAction = {
        id: `review-group:${now.toString(36)}`,
        kind: "review-group",
        createdAt: now,
        assetRefs: refs,
      };
      return action;
    },
    onSuccess: (action) => {
      addPlanAction(action, sourceId, sourceLabel);
      setPlanDrawerOpen(true);
      setLastAdded(true);
      clearCart();
    },
  });

  useEffect(() => {
    if (!lastAdded) return;
    const id = setTimeout(() => setLastAdded(false), 1400);
    return () => clearTimeout(id);
  }, [lastAdded]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) {
        return;
      }
      if (cartIds.length > 0) {
        e.preventDefault();
        clearCart();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cartIds.length, clearCart]);

  if (cartIds.length === 0) return null;

  return (
    <section
      aria-label="Selection actions"
      className={cn(
        "pointer-events-auto absolute bottom-9 left-1/2 z-30 flex h-11 -translate-x-1/2 items-center gap-1.5 rounded-md border border-border-2 bg-surface px-2 font-sans text-sm",
        "animate-[fade-in_140ms_var(--ease-out-quart)]",
      )}
      style={{ boxShadow: "var(--shadow-floating)" }}
    >
      <span className="px-2 font-mono text-sm tabular-nums text-text">
        {cartIds.length}
        <span className="ml-1 text-text-3">selected</span>
      </span>
      <span className="h-5 w-px bg-border" aria-hidden />
      <button
        type="button"
        onClick={clearCart}
        className="inline-flex h-8 items-center gap-1.5 rounded-sm px-2 font-mono text-sm text-text-3 transition-colors hover:bg-hover hover:text-text-2"
        title="Clear selection (Esc)"
      >
        <X size={12} strokeWidth={1.75} />
        Clear
      </button>
      <button
        type="button"
        disabled={add.isPending}
        onClick={() => add.mutate(cartIds)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 font-sans text-sm font-medium transition-colors",
          lastAdded
            ? "bg-ok-bg text-ok"
            : "bg-accent text-white hover:bg-accent-text disabled:cursor-not-allowed disabled:opacity-60",
        )}
        title="Add selection to cleanup plan"
      >
        {lastAdded ? (
          <>
            <Check size={12} strokeWidth={1.75} />
            Added to plan
          </>
        ) : (
          <>
            <ClipboardList size={12} strokeWidth={1.75} />
            {add.isPending ? "Adding…" : "Add to plan"}
          </>
        )}
      </button>
    </section>
  );
}
