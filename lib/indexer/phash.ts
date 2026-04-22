import sharp from "sharp";

export async function computePhash(buf: Buffer, ext: string): Promise<string | null> {
  try {
    const pipeline = ext === "svg" ? sharp(buf, { density: 72 }) : sharp(buf);
    const raw = await pipeline
      .flatten({ background: "#ffffff" })
      .resize(9, 8, { fit: "contain", background: "#ffffff" })
      .greyscale()
      .raw()
      .toBuffer();
    if (raw.length !== 72) return null;

    let hash = 0n;
    let bit = 63n;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = raw[row * 9 + col] ?? 0;
        const right = raw[row * 9 + col + 1] ?? 0;
        if (left > right) hash |= 1n << bit;
        bit--;
      }
    }
    return hash.toString(16).padStart(16, "0");
  } catch {
    return null;
  }
}

export function hamming(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let n = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let dist = 0;
  while (n) {
    dist += Number(n & 1n);
    n >>= 1n;
  }
  return dist;
}
