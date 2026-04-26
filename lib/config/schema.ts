import { z } from "zod";

export const SourceSchema = z.object({
  root: z.string().min(1),
  label: z.string().min(1),
});

export const HarnessSchema = z.object({
  bin: z.string().min(1),
  cwd: z.string().min(1),
});

export const ConfigSchema = z.object({
  sources: z.array(SourceSchema).default([]),
  codeRoots: z.array(z.string()).default(["./src", "./app", "./pages", "./layouts"]),
  styleRoots: z.array(z.string()).default([]),
  extensions: z.array(z.string()).default(["svg", "png", "jpg", "jpeg", "webp", "gif"]),
  ignore: z
    .array(z.string())
    .default(["**/node_modules/**", "**/.next/**", "**/.nuxt/**", "**/dist/**"]),
  dbPath: z.string().default("./data/pika.db"),
  phash: z
    .object({
      enabled: z.boolean().default(true),
      maxHamming: z.number().int().min(0).max(64).default(12),
    })
    .default({ enabled: true, maxHamming: 12 }),
  clip: z
    .object({
      enabled: z.boolean().default(false),
    })
    .default({ enabled: false }),
  usage: z
    .object({
      maxHitsPerAsset: z.number().int().min(1).default(50),
    })
    .default({ maxHitsPerAsset: 50 }),
  agent: z
    .object({
      harnesses: z.record(z.string(), HarnessSchema).default({}),
    })
    .default({ harnesses: {} }),
});

export type Config = z.infer<typeof ConfigSchema>;
export type SourceConfig = z.infer<typeof SourceSchema>;
