"use client";

import { useMutation } from "@tanstack/react-query";
import type { MatchResponse } from "@/app/api/match/route";
import type { ApiResponse } from "@/lib/api/response";

type Input = { file: File; sourceId: number };

async function postMatch({ file, sourceId }: Input): Promise<MatchResponse> {
  const body = new FormData();
  body.append("file", file);
  body.append("sourceId", String(sourceId));

  const res = await fetch("/api/match", { method: "POST", body });
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw new Error(`${res.status} ${res.statusText || "error"}: /api/match`);
  }
  const json = (await res.json()) as ApiResponse<MatchResponse>;
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export function useMatch() {
  return useMutation<MatchResponse, Error, Input>({ mutationFn: postMatch });
}
