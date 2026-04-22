import { readFile } from "node:fs/promises";
import fg from "fast-glob";
import pLimit from "p-limit";
import type { Asset } from "../db/schema";

const CODE_GLOB =
  "**/*.{ts,tsx,js,jsx,mjs,cjs,vue,svelte,astro,html,htm,css,scss,sass,less,styl,json,md,mdx,yml,yaml}";

const FILENAME_RE = /[\w.-]+\.(?:svg|png|jpe?g|webp|gif)\b/gi;

export type UsageHit = {
  assetId: number;
  sourceId: number;
  relPath: string;
  line: number;
  snippet: string;
};

type ScanOpts = {
  sourceId: number;
  codeRoots: string[];
  ignore: string[];
  assets: Asset[];
  maxHitsPerAsset: number;
};

export async function scanUsages(opts: ScanOpts): Promise<UsageHit[]> {
  const { sourceId, codeRoots, ignore, assets, maxHitsPerAsset } = opts;
  const byName = new Map<string, Asset[]>();
  for (const a of assets) {
    const list = byName.get(a.name) ?? [];
    list.push(a);
    byName.set(a.name, list);
  }

  const hitsPerAsset = new Map<number, number>();
  const out: UsageHit[] = [];
  const limit = pLimit(16);

  for (const root of codeRoots) {
    const files = await fg(CODE_GLOB, {
      cwd: root,
      ignore,
      absolute: true,
      onlyFiles: true,
      dot: false,
      suppressErrors: true,
    });

    await Promise.all(
      files.map((codeFile) =>
        limit(async () => {
          let text: string;
          try {
            text = await readFile(codeFile, "utf8");
          } catch {
            return;
          }
          if (!text || text.length > 2_000_000) return;

          const lines = text.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            FILENAME_RE.lastIndex = 0;
            let m: RegExpExecArray | null;
            // biome-ignore lint/suspicious/noAssignInExpressions: canonical regex.exec loop
            while ((m = FILENAME_RE.exec(line)) !== null) {
              const candidates = byName.get(m[0]);
              if (!candidates) continue;
              for (const a of candidates) {
                const n = hitsPerAsset.get(a.id) ?? 0;
                if (n >= maxHitsPerAsset) continue;
                hitsPerAsset.set(a.id, n + 1);
                out.push({
                  assetId: a.id,
                  sourceId,
                  relPath: codeFile.startsWith(`${root}/`)
                    ? codeFile.slice(root.length + 1)
                    : codeFile,
                  line: i + 1,
                  snippet: line.trim().slice(0, 200),
                });
              }
            }
          }
        }),
      ),
    );
  }

  return out;
}
