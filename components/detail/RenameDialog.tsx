"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { Asset } from "@/lib/db/schema";
import { useDebounce } from "@/lib/hooks/useDebounce";
import type { PlanAction } from "@/lib/plan/schema";
import { useRenameAsset, useRenamePreflight } from "@/lib/queries/rename";
import { useSources } from "@/lib/queries/sources";
import type { Conflict, Tip, Warning } from "@/lib/rename/validate";
import { useExplorerStore } from "@/lib/store";
import { Check, Info, RotateCcw, TriangleAlert, X } from "../icons";
import { Button } from "../primitives/Button";
import { IconBtn } from "../primitives/IconBtn";
import { formatCombo, KbdHint } from "../primitives/KbdHint";

type Props = {
  asset: Asset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RenameDialog({ asset, open, onOpenChange }: Props) {
  const [stem, setStem] = useState(() => asset.stem);
  const [deselected, setDeselected] = useState<Set<number>>(() => new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const addPlanAction = useExplorerStore((s) => s.addPlanAction);
  const removePlanAction = useExplorerStore((s) => s.removePlanAction);
  const draftPlan = useExplorerStore((s) => s.draftPlan);
  const sources = useSources();
  const sourceLabel = sources.data?.find((s) => s.id === asset.sourceId)?.label ?? "";

  const newName = stem.trim() ? `${stem.trim()}.${asset.ext}` : "";
  const debouncedName = useDebounce(newName, 200);
  const preflight = useRenamePreflight(asset.id, debouncedName, open && debouncedName.length > 0);
  const rename = useRenameAsset(asset.sourceId);
  const renameRef = useRef(rename);
  renameRef.current = rename;

  useEffect(() => {
    if (!open) {
      setStem(asset.stem);
      setDeselected(new Set());
      renameRef.current.reset();
      return;
    }
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
    return () => clearTimeout(t);
  }, [open, asset.stem]);

  const result = preflight.data;
  const affectedUsages = result?.affectedUsages ?? [];
  const acceptedUsageIds = useMemo(
    () => affectedUsages.filter((u) => !deselected.has(u.id)).map((u) => u.id),
    [affectedUsages, deselected],
  );

  const sameAsCurrent = newName === asset.name;
  const canQuery = !sameAsCurrent && debouncedName.length > 0;
  const canAddToPlan = result?.ok === true && !sameAsCurrent && sourceLabel.length > 0;
  const canRenameNow = result?.canRenameNow === true && !sameAsCurrent;

  const planActionId = useMemo(() => `rename-${asset.id}-${newName}`, [asset.id, newName]);
  const queuedAction = draftPlan?.actions.find((a) => a.id === planActionId);

  const handleAddToPlan = () => {
    if (!result || !canAddToPlan) return;
    if (queuedAction) {
      removePlanAction(queuedAction.id);
      return;
    }
    const action: PlanAction = {
      id: planActionId,
      kind: "rename-asset",
      createdAt: Date.now(),
      asset: {
        assetId: asset.id,
        relPath: asset.relPath,
        name: asset.name,
        size: asset.size,
        usageCount: affectedUsages.length,
      },
      newName: result.newName,
      newRelPath: result.newRelPath,
    };
    addPlanAction(action, asset.sourceId, sourceLabel);
    onOpenChange(false);
  };

  const handleRenameNow = async () => {
    if (!canRenameNow || !result) return;
    try {
      await rename.mutateAsync({
        assetId: asset.id,
        newName: result.newName,
        acceptedUsageIds:
          acceptedUsageIds.length === affectedUsages.length ? "all" : acceptedUsageIds,
        skipStale: false,
      });
      onOpenChange(false);
    } catch {
      /* error shown from rename.error */
    }
  };

  const toggleRef = (id: number) => {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-[dialog-overlay-in_220ms_var(--ease-out-quart)] data-[state=closed]:animate-[dialog-overlay-out_160ms_var(--ease-out-quart)]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex h-[min(600px,90vh)] w-125 flex-col overflow-hidden rounded-md border border-border bg-surface shadow-[0_24px_48px_-24px_rgba(20,20,30,0.25)] [transform:translate(-50%,-50%)] data-[state=open]:animate-[dialog-content-in_220ms_var(--ease-out-quart)] data-[state=closed]:animate-[dialog-content-out_160ms_var(--ease-out-quart)]">
          <div className="flex h-11 flex-shrink-0 items-center justify-between border-b border-border px-3">
            <Dialog.Title className="font-sans text-sm font-semibold text-text">
              Rename asset
            </Dialog.Title>
            <Dialog.Close asChild>
              <IconBtn label="Close">
                <X size={14} strokeWidth={1.5} />
              </IconBtn>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Rename this asset. Updates every reference found in the index.
          </Dialog.Description>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-shrink-0 space-y-3 border-b border-border px-4 py-3">
              <div>
                <div className="mb-1 font-mono text-3xs font-semibold uppercase tracking-wider text-text-3">
                  Current path
                </div>
                <div className="truncate font-mono text-xs text-text-2" title={asset.relPath}>
                  {asset.relPath}
                </div>
              </div>

              <div>
                <label
                  htmlFor="rename-stem"
                  className="mb-1 block font-mono text-3xs font-semibold uppercase tracking-wider text-text-3"
                >
                  New name
                </label>
                <div className="flex h-8 items-stretch rounded-sm border border-border bg-sunken focus-within:border-accent/40">
                  <input
                    ref={inputRef}
                    id="rename-stem"
                    value={stem}
                    onChange={(e) => setStem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                        e.preventDefault();
                        if (canRenameNow) handleRenameNow();
                      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        if (canAddToPlan) handleAddToPlan();
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent px-2.5 font-mono text-sm text-text outline-none placeholder:text-text-4"
                    placeholder={asset.stem}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  {stem !== asset.stem ? (
                    <button
                      type="button"
                      onClick={() => {
                        setStem(asset.stem);
                        setDeselected(new Set());
                        inputRef.current?.focus();
                        inputRef.current?.select();
                      }}
                      title="Reset to current name"
                      aria-label="Reset to current name"
                      className="flex items-center justify-center px-2 text-text-3 transition-colors hover:bg-hover hover:text-text"
                    >
                      <RotateCcw size={12} strokeWidth={1.75} />
                    </button>
                  ) : null}
                  <span className="flex items-center border-l border-border bg-sunken-2 px-2 font-mono text-sm text-text-3">
                    .{asset.ext}
                  </span>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <StatusStrip
                canQuery={canQuery}
                sameAsCurrent={sameAsCurrent}
                isLoading={preflight.isFetching && !preflight.data}
                isError={preflight.isError}
                error={preflight.error}
                conflicts={result?.conflicts ?? []}
                warnings={result?.warnings ?? []}
                tips={result?.tips ?? []}
                affectedCount={affectedUsages.length}
              />

              <ReferencesSection
                usages={affectedUsages}
                deselected={deselected}
                onToggle={toggleRef}
              />

              {rename.isError ? (
                <div className="m-3 rounded-sm border border-danger/30 bg-danger-bg px-2.5 py-1.5 font-mono text-xs text-danger">
                  {(rename.error as Error).message}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex h-11 flex-shrink-0 items-center justify-end gap-2 border-t border-border px-3">
            <Button
              variant="secondary"
              onClick={handleAddToPlan}
              disabled={!canAddToPlan}
              title={!sourceLabel ? "Source label unavailable" : undefined}
            >
              <span>{queuedAction ? "Remove from plan" : "Add to plan"}</span>
              {!queuedAction && canAddToPlan ? (
                <KbdHint keys={formatCombo("mod+enter")} className="ml-1" />
              ) : null}
            </Button>
            <Button
              variant="primary"
              onClick={handleRenameNow}
              disabled={!canRenameNow || rename.isPending}
              title={
                !result?.canRenameNow && result
                  ? blockReason(result.conflicts, result.warnings)
                  : undefined
              }
            >
              <span>{rename.isPending ? "Renaming…" : "Rename now"}</span>
              {canRenameNow && !rename.isPending ? (
                <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-xs border border-white/30 bg-white/10 px-1 font-mono text-3xs font-medium text-white/85">
                  ↵
                </span>
              ) : null}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StatusStrip({
  canQuery,
  sameAsCurrent,
  isLoading,
  isError,
  error,
  conflicts,
  warnings,
  tips,
  affectedCount,
}: {
  canQuery: boolean;
  sameAsCurrent: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  conflicts: Conflict[];
  warnings: Warning[];
  tips: Tip[];
  affectedCount: number;
}) {
  if (sameAsCurrent) {
    return (
      <div className="m-3 rounded-sm border border-border bg-sunken/40 px-2.5 py-1.5 text-xs text-text-3">
        Type a new name to see what will change.
      </div>
    );
  }
  if (!canQuery) {
    return (
      <div className="m-3 rounded-sm border border-border bg-sunken/40 px-2.5 py-1.5 text-xs text-text-3">
        Type a new name.
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="m-3 rounded-sm border border-border bg-sunken/40 px-2.5 py-1.5 text-xs text-text-3">
        Checking…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="m-3 rounded-sm border border-danger/30 bg-danger-bg px-2.5 py-1.5 text-xs text-danger">
        {error instanceof Error ? error.message : "Preflight failed."}
      </div>
    );
  }
  return (
    <div className="m-3 space-y-1.5">
      {conflicts.length === 0 && warnings.length === 0 ? (
        <div className="flex items-center gap-2 rounded-sm border border-ok/30 bg-ok-bg px-2.5 py-1.5 text-xs text-ok">
          <Check size={12} strokeWidth={1.75} className="flex-shrink-0" />
          Ready to rename &middot; {affectedCount} reference
          {affectedCount === 1 ? "" : "s"} will be updated
        </div>
      ) : null}
      {conflicts.map((c) => (
        <div
          key={c.code}
          className="flex items-start gap-2 rounded-sm border border-danger/30 bg-danger-bg px-2.5 py-1.5 text-xs text-danger"
        >
          <TriangleAlert size={12} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" />
          <span>{c.message}</span>
        </div>
      ))}
      {warnings.map((w) => (
        <div
          key={w.code}
          className="flex items-start gap-2 rounded-sm border border-warn/30 bg-warn-bg px-2.5 py-1.5 text-xs text-warn"
        >
          <TriangleAlert size={12} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" />
          <span>
            {w.message}
            {w.detail ? <span className="mt-0.5 block text-text-3">{w.detail}</span> : null}
          </span>
        </div>
      ))}
      {tips.map((t) => (
        <div
          key={t.code}
          className="flex items-start gap-2 rounded-sm border border-border bg-sunken/40 px-2.5 py-1.5 text-xs text-text-3"
        >
          <Info size={12} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

type UsageRow = {
  id: number;
  relPath: string;
  line: number;
  snippet: string;
  commented: boolean;
};

function ReferencesSection({
  usages,
  deselected,
  onToggle,
}: {
  usages: UsageRow[];
  deselected: Set<number>;
  onToggle: (id: number) => void;
}) {
  const hasUsages = usages.length > 0;
  return (
    <div className="border-t border-divider">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="font-mono text-3xs font-semibold uppercase tracking-wider text-text-3">
          {hasUsages
            ? `References · ${usages.length - deselected.size} of ${usages.length} selected`
            : "References"}
        </div>
      </div>
      {hasUsages ? null : (
        <div className="px-4 pb-3 font-mono text-xs text-text-4">
          No references found in the index.
        </div>
      )}
      <div className="space-y-0.5 pb-2">
        {usages.map((u) => {
          const excluded = deselected.has(u.id);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onToggle(u.id)}
              className={cn(
                "flex w-full items-center gap-2 border-divider border-b px-4 py-1.5 text-left font-mono text-xs transition-colors last:border-b-0 hover:bg-hover",
                excluded ? "text-text-4 line-through" : "text-text-2",
              )}
            >
              <span
                className={cn(
                  "flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-xs border",
                  excluded ? "border-border bg-surface" : "border-accent bg-accent",
                )}
              >
                {excluded ? null : <Check size={10} strokeWidth={1.75} className="text-white" />}
              </span>
              <span className="min-w-0 flex-1 truncate" title={u.relPath}>
                {u.relPath}
              </span>
              <span className="flex-shrink-0 text-text-3 tabular-nums">:{u.line}</span>
              {u.commented ? (
                <span className="flex-shrink-0 rounded-xs bg-warn-bg px-1 text-2xs text-warn">
                  commented
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function blockReason(conflicts: Conflict[], warnings: Warning[]): string | undefined {
  if (conflicts.length > 0) return conflicts[0]?.message;
  const blocker = warnings.find((w) =>
    ["SHARED_ACROSS_SOURCES", "NOT_GIT_REPO", "DIRTY_WORKING_TREE", "UNWRITABLE_FILES"].includes(
      w.code,
    ),
  );
  return blocker?.message;
}
