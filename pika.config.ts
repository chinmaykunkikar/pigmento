import type { Config } from "./lib/config/schema";

const config: Config = {
  codeRoots: ["./src", "./app", "./pages", "./layouts"],
  extensions: ["svg", "png", "jpg", "jpeg", "webp", "gif"],
  ignore: ["**/node_modules/**", "**/.next/**", "**/.nuxt/**", "**/dist/**"],
  phash: { enabled: true, maxHamming: 12 },
  clip: { enabled: false },
  usage: { maxHitsPerAsset: 50 },
};

export default config;
