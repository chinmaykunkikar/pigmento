import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createJiti } from "jiti";
import { type Config, ConfigSchema } from "./schema";

export async function loadConfig(cwd: string = process.cwd()): Promise<Config> {
  const configPath = resolve(cwd, "pixeldex.config.ts");
  if (!existsSync(configPath)) {
    throw new Error(`pixeldex.config.ts not found at ${configPath}`);
  }
  const jiti = createJiti(import.meta.url);
  const mod = await jiti.import<{ default: unknown }>(configPath);
  return ConfigSchema.parse(mod.default);
}
