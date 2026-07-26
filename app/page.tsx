"use client";

import { OverviewHome } from "@/components/overview/OverviewHome";
import { useSelectedSource } from "@/lib/hooks/useSelectedSource";

export default function OverviewPage() {
  const source = useSelectedSource();
  if (!source) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <OverviewHome
        sourceId={source.id}
        sourceLabel={source.label}
        lastIndexedAt={source.lastIndexedAt ?? source.createdAt}
      />
    </div>
  );
}
