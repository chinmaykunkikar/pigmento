"use client";

import { useEffect, useState } from "react";
import { useSelectedSource } from "@/lib/hooks/useSelectedSource";
import { useDesignIdentity } from "@/lib/queries/identity";
import { type IndexerRun, useIndexerStatus } from "@/lib/queries/indexer-status";
import { useExplorerStore } from "@/lib/store";
import { PikaMark } from "../brand/PikaMark";
import { ErrorState } from "../primitives/ErrorState";
import { ScrollArea } from "../primitives/ScrollArea";
import { FirstRunEntries } from "./FirstRunEntries";
import { IdentityBand } from "./IdentityBand";
import { KindRows } from "./KindRows";
import { MorphSection } from "./MorphSection";

export function OverviewHome() {
  const source = useSelectedSource();
  const setSelectedSource = useExplorerStore((s) => s.setSelectedSource);
  const indexerRun = useIndexerStatus();
  const identityQ = useDesignIdentity(source?.id ?? null);
  const identity = identityQ.data ?? null;

  const indexed = !!source?.lastIndexedAt;
  const indexing =
    !!indexerRun && !indexerRun.endedAt && (!source || indexerRun.sourceId === source.id);
  const live = indexed && identity !== null;

  const signaturePending = useExplorerStore((s) => s.signaturePending);
  const [playSig, setPlaySig] = useState(false);
  useEffect(() => {
    if (live && signaturePending) {
      setPlaySig(true);
      useExplorerStore.getState().setSignaturePending(false);
    }
  }, [live, signaturePending]);

  return (
    <ScrollArea className="flex-1 bg-bg">
      <div className="mx-auto flex max-w-180 flex-col px-6 pt-8 pb-12">
        {identityQ.isError ? (
          <ErrorState
            error={identityQ.error}
            title="Couldn't read design identity"
            onRetry={() => identityQ.refetch()}
          />
        ) : indexed && !identity ? (
          <div className="py-16 text-center font-mono text-xs text-text-3">
            Reading design identity…
          </div>
        ) : (
          <>
            <IdentityBand
              identity={live ? identity : null}
              sourceLabel={source?.label ?? null}
              lastIndexedAt={source?.lastIndexedAt ?? source?.createdAt ?? null}
              indexing={indexing}
              playSignature={playSig}
            />

            <MorphSection open={!live}>
              <div className="pt-6">
                {indexing && indexerRun ? (
                  <IndexingInline run={indexerRun} />
                ) : (
                  <FirstRunEntries onAdded={(id) => setSelectedSource(id)} />
                )}
              </div>
            </MorphSection>

            <MorphSection open={live}>
              {identity ? (
                <div className="pt-6">
                  <KindRows identity={identity} />
                </div>
              ) : null}
            </MorphSection>
          </>
        )}
      </div>
    </ScrollArea>
  );
}

function IndexingInline({ run }: { run: IndexerRun }) {
  const done = run.stages.filter((s) => s.status === "done").length;
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 font-mono text-xs text-text-3">
        <span className="flex min-w-0 items-center gap-1.5">
          <PikaMark size={12} blink />
          <span className="truncate">indexing {run.label}…</span>
        </span>
        <span className="flex-shrink-0 tabular-nums">
          {done} / {run.stages.length} · {run.progress}%
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-sunken">
        <div
          className="h-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${run.progress}%` }}
        />
      </div>
      {run.currentStage ? (
        <div className="font-mono text-2xs text-text-4">{run.currentStage}</div>
      ) : null}
    </div>
  );
}
