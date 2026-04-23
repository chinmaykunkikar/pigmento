import { join } from "node:path";
import { env, pipeline, RawImage } from "@huggingface/transformers";
import sharp from "sharp";

const MODEL_ID = "Xenova/clip-vit-base-patch32";
const RASTER_PX = 256;

env.cacheDir = join(process.cwd(), "data", "models");
env.allowLocalModels = false;

export type ClipImageEncoder = Awaited<ReturnType<typeof pipeline<"image-feature-extraction">>>;

let encoderPromise: Promise<ClipImageEncoder> | null = null;

export async function getClipImageEncoder(): Promise<ClipImageEncoder> {
  if (!encoderPromise) {
    encoderPromise = pipeline("image-feature-extraction", MODEL_ID, {
      dtype: "q8",
    });
  }
  return encoderPromise;
}

export async function embedImage(buf: Buffer, ext: string): Promise<Float32Array | null> {
  try {
    const image = await rasterize(buf, ext);
    const extractor = await getClipImageEncoder();
    const output = await extractor(image);
    const flat = output.data as Float32Array;
    const copy = new Float32Array(flat);
    return l2Normalize(copy);
  } catch {
    return null;
  }
}

async function rasterize(buf: Buffer, ext: string): Promise<RawImage> {
  const input = ext === "svg" ? sharp(buf, { density: 96 }) : sharp(buf);
  const { data, info } = await input
    .flatten({ background: "#ffffff" })
    .resize(RASTER_PX, RASTER_PX, { fit: "cover", background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new RawImage(new Uint8ClampedArray(data), info.width, info.height, 3);
}

function l2Normalize(v: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  if (norm === 0) return v;
  const inv = 1 / Math.sqrt(norm);
  for (let i = 0; i < v.length; i++) v[i] *= inv;
  return v;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function serializeEmbedding(v: Float32Array): Buffer {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}

export function deserializeEmbedding(b: Buffer): Float32Array {
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
}
