import { extname } from "node:path";
import { dominantColor } from "@/lib/indexer/color";
import { hashBuffer } from "@/lib/indexer/hash";
import { getMeta } from "@/lib/indexer/meta";
import { computePhash } from "@/lib/indexer/phash";
import { parseSvg } from "@/lib/indexer/svg";
import { normalizeExt, type QuerySignature } from "./ext";

export type { QuerySignature } from "./ext";

export async function computeSignature(buf: Buffer, name: string): Promise<QuerySignature> {
  const ext = normalizeExt(name);
  const rawExt = extname(name).slice(1).toLowerCase();
  const stem = name.slice(0, name.length - (rawExt.length ? rawExt.length + 1 : 0));

  const [{ content, sha1 }, phash, meta, dom] = await Promise.all([
    hashBuffer(buf),
    computePhash(buf, ext),
    getMeta(buf, ext),
    dominantColor(buf, ext),
  ]);

  const svg = ext === "svg" ? parseSvg(buf.toString("utf8")) : null;

  return {
    name,
    stem,
    ext,
    size: buf.length,
    sha1,
    contentHash: content,
    phash,
    width: meta.width,
    height: meta.height,
    dominantColor: dom,
    svg,
  };
}
