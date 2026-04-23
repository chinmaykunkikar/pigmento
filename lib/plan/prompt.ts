import type { Plan, PlanAction } from "./schema";

export function generatePrompt(plan: Plan): string {
  if (plan.actions.length === 0) {
    return `# ${plan.name}\n\nNo actions queued yet.\n`;
  }

  const lines: string[] = [];
  lines.push(`# ${plan.name}`);
  lines.push("");
  lines.push(
    `Cleanup plan for \`${plan.sourceLabel}\`. Please apply the actions below, open a pull request titled "${plan.name}", and summarise reclaimed bytes in the description.`,
  );
  lines.push("");

  for (let i = 0; i < plan.actions.length; i++) {
    const a = plan.actions[i];
    if (!a) continue;
    lines.push(`${i + 1}. ${actionSentence(a)}`);
    if (a.kind !== "delete-unused") {
      lines.push(`   - Keep: \`${a.keep.relPath}\``);
    }
    for (const d of a.drop) {
      const refNote =
        d.usageCount > 0
          ? ` (${d.usageCount} reference${d.usageCount === 1 ? "" : "s"} to rewrite)`
          : "";
      lines.push(`   - Drop: \`${d.relPath}\`${refNote}`);
    }
    lines.push("");
  }

  lines.push("## Guardrails");
  lines.push("- Run tests before committing.");
  lines.push("- Do not touch any file not listed in the drop list above.");
  lines.push("- Rewrite every reference to dropped files to point at the kept file.");
  lines.push("");

  return lines.join("\n");
}

function actionSentence(a: PlanAction): string {
  if (a.kind === "merge-exact") {
    return `Merge ${a.drop.length} byte-identical duplicate${a.drop.length === 1 ? "" : "s"} of \`${a.keep.name}\` into the kept copy.`;
  }
  if (a.kind === "merge-cluster") {
    return `Merge the \`${a.clusterKey}\` cluster (${a.drop.length} variant${a.drop.length === 1 ? "" : "s"}) into \`${a.keep.name}\`.`;
  }
  return `Delete ${a.drop.length} unused asset${a.drop.length === 1 ? "" : "s"}.`;
}
