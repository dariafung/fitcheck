// An on-model product photo redrawn as the garment alone on white, so the
// closet and the outfit boards never show a person. Used when adding an
// item and when checking one before buying.
import sharp from "sharp";
import { AiError, segmentGarment } from "@/lib/ai";
import { describeItem } from "@/lib/ai/live/describe";
import type { ItemTags } from "@/lib/ai/schemas/common";
import { tryTakeDaily } from "@/lib/limits/daily";
import { frameOnWhite } from "./frame";

// The cleaned-up photo framed like every item photo, or null when the model
// couldn't do it (over budget, refused, failed): callers keep the original.
export async function cleanUpPhoto(photo: Buffer, garment: { title: string; tags: ItemTags }): Promise<Buffer | null> {
  const png = await sharp(photo)
    .rotate()
    .png()
    .toBuffer()
    .catch(() => null);
  if (!png) return null;
  let output;
  try {
    output = await segmentGarment({
      image: { kind: "inline", mime: "image/png", base64: png.toString("base64") },
      category: garment.tags.category,
      description: describeItem(garment.title, garment.tags),
    });
  } catch (err) {
    if (err instanceof AiError) return null;
    throw err;
  }
  return frameOnWhite(Buffer.from(output.image.base64, "base64"));
}

// cleanUpPhoto as one counted cut-out (lib/limits/daily.ts): null, the same
// as a cut-out that failed, once the caller's count for today is used up.
// A failed cut-out gives its count back.
export async function cleanUpPhotoWithinLimit(
  photo: Buffer,
  garment: { title: string; tags: ItemTags },
): Promise<Buffer | null> {
  const ticket = await tryTakeDaily("cutout");
  if (!ticket) return null;
  const cleaned = await cleanUpPhoto(photo, garment);
  if (!cleaned) await ticket.giveBack();
  return cleaned;
}
