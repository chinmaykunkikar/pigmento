"use client";

import { useMutation } from "@tanstack/react-query";
import type { Plan } from "@/lib/plan/schema";
import { apiPost } from "./client";

export type DispatchMode = "dry-run" | "patch" | "open-pr";
export type DispatchHarness = "claude-code" | "devin" | "codex-cli";

export type DispatchResult = {
  dir: string;
  files: string[];
  hint: string;
};

type Input = { plan: Plan; mode: DispatchMode; harness: DispatchHarness };

export function useDispatchPlan() {
  return useMutation<DispatchResult, Error, Input>({
    mutationFn: (input) => apiPost<DispatchResult, Input>("/api/plans/dispatch", input),
  });
}
