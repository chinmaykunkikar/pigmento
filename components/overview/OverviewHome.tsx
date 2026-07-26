"use client";

import { useEffect, useRef } from "react";
import { useDesignIdentity } from "@/lib/queries/identity";
import { useExplorerStore } from "@/lib/store";
import { ErrorState } from "../primitives/ErrorState";
import { ScrollArea } from "../primitives/ScrollArea";
import { IdentityBand } from "./IdentityBand";
import { KindRows } from "./KindRows";

type Props = {
  sourceId: number;
  sourceLabel: string;
  lastIndexedAt: string | null;
};

export function OverviewHome({ sourceId, sourceLabel, lastIndexedAt }: Props) {
  const q = useDesignIdentity(sourceId);
  const playRef = useRef(useExplorerStore.getState().signaturePending);
  useEffect(() => {
    if (playRef.current) useExplorerStore.getState().setSignaturePending(false);
  }, []);

  return (
    <ScrollArea className="flex-1 bg-bg">
      <div className="mx-auto flex max-w-180 flex-col gap-6 px-6 pt-8 pb-12">
        {q.isLoading ? (
          <div className="py-16 text-center font-mono text-xs text-text-3">
            Reading design identity…
          </div>
        ) : q.isError ? (
          <ErrorState
            error={q.error}
            title="Couldn't read design identity"
            onRetry={() => q.refetch()}
          />
        ) : q.data ? (
          <>
            <IdentityBand
              identity={q.data}
              sourceLabel={sourceLabel}
              lastIndexedAt={lastIndexedAt}
              playSignature={playRef.current}
            />
            <KindRows identity={q.data} />
          </>
        ) : null}
      </div>
    </ScrollArea>
  );
}
