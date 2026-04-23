import type { Plan } from "@/lib/plan/schema";

export type DispatchHarnessName = "claude-code" | "devin" | "codex-cli";
export type DispatchMode = "dry-run" | "patch" | "open-pr";
export type RunnableMode = Exclude<DispatchMode, "dry-run">;

export type DispatchJobInput = {
  plan: Plan;
  mode: RunnableMode;
  cwd: string;
  planDir: string;
};

export type DispatchEvent =
  | { type: "stdout"; line: string; ts: number }
  | { type: "stderr"; line: string; ts: number }
  | { type: "info"; line: string; ts: number }
  | { type: "done"; exitCode: number; branch?: string; prUrl?: string; ts: number }
  | { type: "error"; message: string; ts: number };

export type HarnessReadiness = { ready: true } | { ready: false; reason: string };

export interface Harness {
  readonly name: DispatchHarnessName;
  isReady(mode: RunnableMode): Promise<HarnessReadiness>;
  run(input: DispatchJobInput, signal: AbortSignal): AsyncIterable<DispatchEvent>;
}
