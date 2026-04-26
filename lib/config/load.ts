import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createJiti } from "jiti";
import { type Config, ConfigSchema } from "./schema";

export async function loadConfig(cwd: string = process.cwd()): Promise<Config> {
  const configPath = resolve(cwd, "pika.config.ts");
  if (!existsSync(configPath)) {
    throw new Error(`pika.config.ts not found at ${configPath}`);
  }
  const jiti = createJiti(import.meta.url);
  const mod = await jiti.import<{ default: unknown }>(configPath);
  return ConfigSchema.parse(mod.default);
}

let cachedConfig: Promise<Config> | null = null;

export function getConfig(): Promise<Config> {
  if (!cachedConfig) cachedConfig = loadConfig();
  return cachedConfig;
}
