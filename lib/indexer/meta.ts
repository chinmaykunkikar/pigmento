import sharp from "sharp";

export async function getMeta(
  buf: Buffer,
  ext: string,
): Promise<{ width: number | null; height: number | null }> {
  try {
    const pipeline = ext === "svg" ? sharp(buf, { density: 72 }) : sharp(buf);
    const m = await pipeline.metadata();
    return { width: m.width ?? null, height: m.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}
