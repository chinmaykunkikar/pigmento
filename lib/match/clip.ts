import { join } from "node:path";
import { env, pipeline, RawImage } from "@huggingface/transformers";
import sharp from "sharp";

const MODEL_ID = "Xenova/clip-vit-base-patch32";
// pinned commit: calibrated thresholds (entropy guards, MAD gate fixtures)
// assume stable embeddings; bump deliberately and re-measure, never float main
const MODEL_REVISION = "d15189d7028b43f1d3e65039190477f6af591c2a";
const RASTER_PX = 256;
const NEAR_WHITE = 250;

env.cacheDir = join(process.cwd(), "data", "models");
// opt-in escape hatch for offline installs with pre-seeded model dirs
env.allowLocalModels = process.env.PIKA_ALLOW_LOCAL_MODELS === "1";

export type ClipImageEncoder = Awaited<ReturnType<typeof pipeline<"image-feature-extraction">>>;

const ENCODER_KEY = Symbol.for("pika.clipEncoder");

type EncoderStore = { [k: symbol]: Promise<ClipImageEncoder> | undefined };

// globalThis-keyed so dev hot-reload reuses the loaded model; a rejected load
// clears the slot so one flaky download does not disable CLIP until restart
export function getClipImageEncoder(): Promise<ClipImageEncoder> {
  const g = globalThis as unknown as EncoderStore;
  let promise = g[ENCODER_KEY];
  if (!promise) {
    promise = pipeline("image-feature-extraction", MODEL_ID, {
      dtype: "q8",
      revision: MODEL_REVISION,
    }).catch((err) => {
      g[ENCODER_KEY] = undefined;
      throw err;
    });
    g[ENCODER_KEY] = promise;
  }
  return promise;
}

export type EmbedResult = {
  vec: Float32Array;
  whiteFraction: number;
};

export async function embedImage(buf: Buffer, ext: string): Promise<EmbedResult> {
  const { image, whiteFraction } = await rasterize(buf, ext);
  const extractor = await getClipImageEncoder();
  const output = await extractor(image);
  const flat = output.data as Float32Array;
  const copy = new Float32Array(flat);
  return { vec: l2Normalize(copy), whiteFraction };
}

async function rasterize(
  buf: Buffer,
  ext: string,
): Promise<{ image: RawImage; whiteFraction: number }> {
  const input = ext === "svg" ? sharp(buf, { density: 96 }) : sharp(buf);
  const { data, info } = await input
    .flatten({ background: "#ffffff" })
    .resize(RASTER_PX, RASTER_PX, { fit: "cover", background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let whitePixels = 0;
  const totalPixels = info.width * info.height;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i] ?? 0;
    const gch = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    if (r >= NEAR_WHITE && gch >= NEAR_WHITE && b >= NEAR_WHITE) whitePixels++;
  }
  const whiteFraction = totalPixels === 0 ? 1 : whitePixels / totalPixels;

  return {
    image: new RawImage(new Uint8ClampedArray(data), info.width, info.height, 3),
    whiteFraction,
  };
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
