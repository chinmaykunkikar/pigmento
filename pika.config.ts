import type { Config } from "./lib/config/schema";

const config: Config = {
  sources: [],
  codeRoots: ["./src", "./app", "./pages", "./layouts"],
  styleRoots: ["./assets/css", "./src/styles"],
  extensions: ["svg", "png", "jpg", "jpeg", "webp", "gif"],
  ignore: ["**/node_modules/**", "**/.next/**", "**/.nuxt/**", "**/dist/**"],
  dbPath: "./data/pika.db",
  phash: { enabled: true, maxHamming: 12 },
  clip: { enabled: false },
  usage: { maxHitsPerAsset: 50 },
  agent: {
    harnesses: {
      "claude-code": { bin: "claude", cwd: "./" },
    },
  },
};

export default config;
