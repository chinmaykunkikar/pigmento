"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { GroupSort, GroupsPage } from "../db/queries/groups";
import { apiGet } from "./client";
import { qk } from "./keys";

export function useGroups(sourceId: number | null, sort: GroupSort) {
  return useQuery({
    queryKey:
      sourceId !== null ? [...qk.groups("name"), sourceId, sort] : ["groups", "name", "none"],
    queryFn: () => {
      const params = new URLSearchParams({
        sourceId: String(sourceId),
        kind: "name",
        sort,
      });
      return apiGet<GroupsPage>(`/api/groups?${params.toString()}`);
    },
    enabled: sourceId !== null,
    placeholderData: keepPreviousData,
  });
}
