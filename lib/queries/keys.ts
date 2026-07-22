export const qk = {
  sources: ["sources"] as const,
  tree: (sourceId: number) => ["tree", sourceId] as const,
  folder: (path: string) => ["folder", path] as const,
  asset: (id: number) => ["asset", id] as const,
  usages: (id: number) => ["asset", id, "usages"] as const,
  groups: (kind: string) => ["groups", kind] as const,
  duplicates: (mode: string) => ["duplicates", mode] as const,
  overview: (sourceId: number) => ["overview", sourceId] as const,
  renamePreflight: (id: number, target: string) =>
    ["asset", id, "rename", "preflight", target] as const,
  styles: ["styles"] as const,
  palette: (sourceId: number) => ["palette", sourceId] as const,
  drift: (sourceId: number) => ["drift", sourceId] as const,
  coverage: (sourceId: number) => ["coverage", sourceId] as const,
  status: ["status"] as const,
};
