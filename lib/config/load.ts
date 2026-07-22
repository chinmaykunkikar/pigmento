import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createJiti } from "jiti";
import { type Config, ConfigSchema } from "./schema";

function resolveConfigPath(cwd: string): string {
  const configPath = resolve(cwd, "pigmento.config.ts");
  if (existsSync(configPath)) return configPath;
  const legacyPath = resolve(cwd, "pika.config.ts");
  if (existsSync(legacyPath)) {
    console.warn("pika.config.ts is deprecated; rename it to pigmento.config.ts");
    return legacyPath;
  }
  throw new Error(`pigmento.config.ts not found at ${configPath}`);
}

export async function loadConfig(cwd: string = process.cwd()): Promise<Config> {
  const configPath = resolveConfigPath(cwd);
  const jiti = createJiti(import.meta.url);
  const mod = await jiti.import<{ default: unknown }>(configPath);
  return ConfigSchema.parse(mod.default);
}

let cachedConfig: Promise<Config> | null = null;

export function getConfig(): Promise<Config> {
  if (!cachedConfig) cachedConfig = loadConfig();
  return cachedConfig;
}
