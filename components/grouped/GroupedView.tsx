"use client";

import { useState } from "react";
import type { GroupSort } from "@/lib/db/queries/groups";
import { useGroups } from "@/lib/queries/groups";
import { ClusterRow } from "./ClusterRow";
import { GroupedBreadcrumb } from "./GroupedBreadcrumb";

type Props = { sourceId: number; sourceLabel: string };

export function GroupedView({ sourceId, sourceLabel }: Props) {
  const [sort, setSort] = useState<GroupSort>("size");
  const q = useGroups(sourceId, sort);
  const page = q.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <GroupedBreadcrumb
        sourceLabel={sourceLabel}
        total={page?.total ?? 0}
        totalVariants={page?.totalVariants ?? 0}
        sort={sort}
        onSortChange={setSort}
      />
      <div className="flex-1 overflow-auto bg-bg">
        {q.isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-text-3">
            Loading clusters…
          </div>
        ) : q.isError ? (
          <div className="flex h-full items-center justify-center text-sm text-danger">
            {(q.error as Error).message}
          </div>
        ) : !page || page.groups.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-sm text-text-3">
            <span>No clusters found in this source</span>
            <span className="text-xs text-text-4">
              Clusters form when two or more assets share a canonical stem
            </span>
          </div>
        ) : (
          <div>
            {page.groups.map((g) => (
              <ClusterRow key={g.id} group={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
