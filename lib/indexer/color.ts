import sharp from "sharp";

export async function dominantColor(buf: Buffer, ext: string): Promise<string | null> {
  const pipeline = ext === "svg" ? sharp(buf, { density: 72 }) : sharp(buf);
  const { data } = await pipeline
    .flatten({ background: "#ffffff" })
    .resize(1, 1, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [r, g, b] = data;
  if (r === undefined || g === undefined || b === undefined) return null;
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
