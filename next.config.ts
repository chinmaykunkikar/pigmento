import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "sharp"],
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
