import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { serializePlan } from "@/lib/plan/export";
import { generatePrompt } from "@/lib/plan/prompt";
import type { Plan } from "@/lib/plan/schema";
import type { DispatchMode } from "./types";

export type PlanArtifacts = {
  dir: string;
  files: string[];
  jsonPath: string;
  promptPath: string;
};

export async function writePlanArtifacts(
  plan: Plan,
  sourceRoot: string,
  mode: DispatchMode,
): Promise<PlanArtifacts> {
  const dir = join(sourceRoot, ".pixeldex", plan.id);
  await mkdir(dir, { recursive: true });
  const jsonPath = join(dir, "plan.json");
  const promptPath = join(dir, "plan.md");
  await writeFile(jsonPath, serializePlan(plan, "json"), "utf8");
  await writeFile(promptPath, generatePrompt(plan, mode), "utf8");
  return { dir, files: [jsonPath, promptPath], jsonPath, promptPath };
}
