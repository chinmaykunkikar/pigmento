import type { Plan, PlanAction } from "./schema";
import { planFormatVersion } from "./schema";

export type ExportFormat = "json" | "csv" | "yaml";

export function serializePlan(plan: Plan, format: ExportFormat): string {
  if (format === "json") return serializeJson(plan);
  if (format === "csv") return serializeCsv(plan);
  return serializeYaml(plan);
}

function serializeJson(plan: Plan): string {
  return JSON.stringify(plan, null, 2);
}

function serializeCsv(plan: Plan): string {
  const header = [
    "action_id",
    "kind",
    "role",
    "asset_id",
    "rel_path",
    "name",
    "size",
    "usage_count",
    "cluster_key",
  ].join(",");
  const rows: string[] = [header];
  for (const a of plan.actions) {
    const key = clusterKeyOf(a);
    rows.push(
      [
        a.id,
        a.kind,
        "keep",
        keepAssetId(a),
        keepPath(a),
        keepName(a),
        keepSize(a),
        keepUsage(a),
        key,
      ]
        .map(csvCell)
        .join(","),
    );
    for (const d of a.drop) {
      rows.push(
        [a.id, a.kind, "drop", d.assetId, d.relPath, d.name, d.size, d.usageCount, key]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return rows.join("\n");
}

function serializeYaml(plan: Plan): string {
  const lines: string[] = [];
  lines.push(`version: "${plan.version}"`);
  lines.push(`id: ${yamlStr(plan.id)}`);
  lines.push(`name: ${yamlStr(plan.name)}`);
  lines.push(`sourceId: ${plan.sourceId}`);
  lines.push(`sourceLabel: ${yamlStr(plan.sourceLabel)}`);
  lines.push(`createdAt: ${plan.createdAt}`);
  lines.push(`updatedAt: ${plan.updatedAt}`);
  lines.push(`actions:`);
  for (const a of plan.actions) {
    lines.push(`  - id: ${yamlStr(a.id)}`);
    lines.push(`    kind: ${a.kind}`);
    if (a.kind === "merge-exact") lines.push(`    hashKey: ${yamlStr(a.hashKey)}`);
    if (a.kind === "merge-cluster") {
      lines.push(`    clusterId: ${a.clusterId}`);
      lines.push(`    clusterKey: ${yamlStr(a.clusterKey)}`);
      lines.push(`    clusterKind: ${a.clusterKind}`);
    }
    if (a.kind === "merge-exact" || a.kind === "merge-cluster") {
      lines.push(`    keep:`);
      lines.push(yamlAsset(a.keep, 6));
    }
    lines.push(`    drop:`);
    for (const d of a.drop) {
      lines.push(yamlAsset(d, 6, true));
    }
  }
  lines.push("");
  return lines.join("\n");
}

function yamlAsset(
  a: Plan["actions"][number]["drop"][number],
  indent: number,
  dashed = false,
): string {
  const pad = " ".repeat(indent);
  const dash = dashed ? "- " : "";
  const subPad = " ".repeat(indent + (dashed ? 2 : 0));
  const lines = [
    `${pad}${dash}assetId: ${a.assetId}`,
    `${subPad}relPath: ${yamlStr(a.relPath)}`,
    `${subPad}name: ${yamlStr(a.name)}`,
    `${subPad}size: ${a.size}`,
    `${subPad}usageCount: ${a.usageCount}`,
  ];
  return lines.join("\n");
}

function yamlStr(s: string): string {
  if (/^[a-zA-Z0-9._/-]+$/.test(s)) return s;
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function csvCell(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function clusterKeyOf(a: PlanAction): string {
  if (a.kind === "merge-exact") return a.hashKey;
  if (a.kind === "merge-cluster") return a.clusterKey;
  return "";
}
function keepAssetId(a: PlanAction): number | "" {
  return a.kind === "delete-unused" ? "" : a.keep.assetId;
}
function keepPath(a: PlanAction): string {
  return a.kind === "delete-unused" ? "" : a.keep.relPath;
}
function keepName(a: PlanAction): string {
  return a.kind === "delete-unused" ? "" : a.keep.name;
}
function keepSize(a: PlanAction): number | "" {
  return a.kind === "delete-unused" ? "" : a.keep.size;
}
function keepUsage(a: PlanAction): number | "" {
  return a.kind === "delete-unused" ? "" : a.keep.usageCount;
}

export function planSchemaFooter(): string {
  return planFormatVersion;
}
