import { claudeCodeHarness } from "./claude-code";
import type { DispatchHarnessName, Harness, HarnessReadiness, RunnableMode } from "./types";

const HARNESSES: Partial<Record<DispatchHarnessName, Harness>> = {
  "claude-code": claudeCodeHarness,
};

export function getHarness(name: DispatchHarnessName): Harness | null {
  return HARNESSES[name] ?? null;
}

export async function checkHarness(
  name: DispatchHarnessName,
  mode: RunnableMode,
): Promise<{ harness: Harness | null; readiness: HarnessReadiness }> {
  const harness = getHarness(name);
  if (!harness) {
    return {
      harness: null,
      readiness: {
        ready: false,
        reason: `${name} adapter is not wired up yet. Track progress in the PRD.`,
      },
    };
  }
  const readiness = await harness.isReady(mode);
  return { harness, readiness };
}
