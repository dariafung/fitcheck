import sharp, { type Metadata } from "sharp";
import type { ExtractItemOutput } from "@/lib/ai";
import type { EntryErrorCode } from "./draft";
import { toItemWebp } from "./images";

// Vercel caps request bodies at 4.5 MB; the page shrinks screenshots to
// fit this first (see components/entry/shrink.ts).
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MIN_SCREENSHOT_SIDE = 300;
const MIN_PHOTO_SIDE = 120;
// Models round; a box a hair past the edge is still fine once clamped.
const EDGE_SLACK = 0.02;
const FORMATS = new Set(["png", "jpeg", "webp"]);

export interface Screenshot {
  data: Buffer;
  mime: string;
  width: number;
  height: number;
}

export async function readScreenshot(
  file: Blob,
): Promise<Screenshot | { error: EntryErrorCode }> {
  if (file.size > MAX_UPLOAD_BYTES) return { error: "too_large" };
  const data = Buffer.from(await file.arrayBuffer());
  let meta: Metadata;
  try {
    meta = await sharp(data, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    return { error: "not_image" };
  }
  if (!meta.format || !FORMATS.has(meta.format) || !meta.width || !meta.height) {
    return { error: "not_image" };
  }
  // EXIF orientation 5–8 swaps width and height.
  const swap = (meta.orientation ?? 1) >= 5;
  const width = swap ? meta.height : meta.width;
  const height = swap ? meta.width : meta.height;
  if (Math.min(width, height) < MIN_SCREENSHOT_SIDE) return { error: "too_small" };
  return { data, mime: `image/${meta.format}`, width, height };
}

type Box = NonNullable<ExtractItemOutput["productBox"]>;
export interface PixelBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

// The model's box in pixels, or undefined when it is outside the screenshot
// or too small to be a usable product photo.
export function pixelBox(box: Box | undefined, width: number, height: number): PixelBox | undefined {
  if (!box) return undefined;
  const { x, y, width: w, height: h } = box;
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return undefined;
  if (x < -EDGE_SLACK || y < -EDGE_SLACK || x + w > 1 + EDGE_SLACK || y + h > 1 + EDGE_SLACK) {
    return undefined;
  }
  const left = Math.max(0, Math.round(x * width));
  const top = Math.max(0, Math.round(y * height));
  const right = Math.min(width, Math.round((x + w) * width));
  const bottom = Math.min(height, Math.round((y + h) * height));
  if (right - left < MIN_PHOTO_SIDE || bottom - top < MIN_PHOTO_SIDE) return undefined;
  return { left, top, width: right - left, height: bottom - top };
}

// The product photo cut out of the screenshot as WebP. Without a usable box
// the whole screenshot stands in, and `cropped` says so.
export async function productPhoto(
  shot: Screenshot,
  box: Box | undefined,
): Promise<{ webp: Buffer; cropped: boolean }> {
  const region = pixelBox(box, shot.width, shot.height);
  const image = sharp(shot.data).rotate();
  if (region) image.extract(region);
  return { webp: await toItemWebp(image), cropped: !!region };
}
