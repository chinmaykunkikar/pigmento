"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { useExplorerStore } from "@/lib/store";
import { CleanupPlan } from "./CleanupPlan";

type Props = { sourceLabel: string };

export function PlanDrawer({ sourceLabel }: Props) {
  const open = useExplorerStore((s) => s.planDrawerOpen);
  const setOpen = useExplorerStore((s) => s.setPlanDrawerOpen);
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (asideRef.current?.contains(target)) return;
      if (target.closest?.("[data-plan-trigger]")) return;
      if (target.closest?.("[data-radix-popper-content-wrapper]")) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <aside
      ref={asideRef}
      aria-hidden={!open}
      aria-label="Cleanup plan"
      data-plan-drawer="true"
      className={cn(
        "absolute inset-y-0 right-0 z-20 flex w-125 flex-col overflow-hidden border-l border-border bg-surface transition-transform duration-300 ease-out",
        open ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
      style={{ boxShadow: "var(--shadow-drawer)" }}
    >
      <CleanupPlan sourceLabel={sourceLabel} />
    </aside>
  );
}
