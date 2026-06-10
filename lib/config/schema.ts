import { z } from "zod";

export const ConfigSchema = z.object({
  codeRoots: z.array(z.string()).default(["./src", "./app", "./pages", "./layouts"]),
  extensions: z.array(z.string()).default(["svg", "png", "jpg", "jpeg", "webp", "gif"]),
  ignore: z
    .array(z.string())
    .default(["**/node_modules/**", "**/.next/**", "**/.nuxt/**", "**/dist/**"]),
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
});

export type Config = z.infer<typeof ConfigSchema>;
