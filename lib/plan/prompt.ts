import type { DispatchMode } from "./dispatch/types";
import type { Plan, PlanAction } from "./schema";

export function generatePrompt(plan: Plan, mode: DispatchMode = "dry-run"): string {
  if (plan.actions.length === 0) {
    return `# ${plan.name}\n\nNo actions queued yet.\n`;
  }

  const lines: string[] = [];
  lines.push(`# ${plan.name}`);
  lines.push("");
  lines.push(intro(plan, mode));
  lines.push("");

  for (let i = 0; i < plan.actions.length; i++) {
    const a = plan.actions[i];
    if (!a) continue;
    lines.push(`${i + 1}. ${actionSentence(a)}`);
    if (a.kind === "review-group") {
      if (a.note) lines.push(`   - Note: ${a.note}`);
      for (const r of a.assetRefs) {
        const refNote =
          r.usageCount > 0 ? ` (${r.usageCount} reference${r.usageCount === 1 ? "" : "s"})` : "";
        lines.push(`   - Review: \`${r.relPath}\`${refNote}`);
      }
      lines.push("");
      continue;
    }
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
  for (const g of guardrails(mode)) lines.push(`- ${g}`);
  lines.push("");

  return lines.join("\n");
}

function intro(plan: Plan, mode: DispatchMode): string {
  const base = `Cleanup plan for \`${plan.sourceLabel}\`.`;
  if (mode === "patch") {
    return `${base} Apply the actions below directly to the working tree. Do not create a branch, commit, or push — leave the changes uncommitted for the user to review.`;
  }
  if (mode === "open-pr") {
    return `${base} Apply the actions below, create a new branch, commit the changes, push it, and open a pull request titled "${plan.name}" summarising reclaimed bytes in the description.`;
  }
  return `${base} Please apply the actions below, open a pull request titled "${plan.name}", and summarise reclaimed bytes in the description.`;
}

function guardrails(mode: DispatchMode): string[] {
  const shared = [
    "Before editing, read any of `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `README.md` at the repo root if they exist, and follow the conventions they specify (commit style, formatting, branch naming, review process, etc.).",
    "Do not touch any file not listed in the drop list above.",
    "Rewrite every reference to dropped files to point at the kept file.",
  ];
  if (mode === "patch") {
    return [...shared, "Do not run git commands — no branch, no commit, no push."];
  }
  if (mode === "open-pr") {
    return [
      ...shared,
      "Before creating your working branch: detect the repo's default branch with `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` (fallback: `git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'`). Check that branch out and `git pull` it — NEVER branch off whatever branch is currently checked out, which may be an unrelated in-progress feature branch.",
      "Run tests before committing.",
      "Branch name should reflect the plan id.",
      "Use `gh pr create --base <default-branch>` to open the PR against the detected default branch, and print the URL as your final output.",
    ];
  }
  return [...shared, "Run tests before committing."];
}

function actionSentence(a: PlanAction): string {
  if (a.kind === "merge-exact") {
    return `Merge ${a.drop.length} byte-identical duplicate${a.drop.length === 1 ? "" : "s"} of \`${a.keep.name}\` into the kept copy.`;
  }
  if (a.kind === "merge-cluster") {
    return `Merge the \`${a.clusterKey}\` cluster (${a.drop.length} variant${a.drop.length === 1 ? "" : "s"}) into \`${a.keep.name}\`.`;
  }
  if (a.kind === "review-group") {
    return `Review ${a.assetRefs.length} flagged asset${a.assetRefs.length === 1 ? "" : "s"} and decide whether to merge, delete, or keep.`;
  }
  return `Delete ${a.drop.length} unused asset${a.drop.length === 1 ? "" : "s"}.`;
}
