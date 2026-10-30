import { aiErrorResponse, extractItem } from "@/lib/ai";
import { requireWriter } from "@/lib/auth/guard";
import { createServerClient } from "@/lib/db/server";
import type { EntryErrorCode, ItemDraft } from "@/lib/entry/draft";
import { signImages, storeImage } from "@/lib/entry/images";
import { productPhoto, readScreenshot } from "@/lib/entry/screenshot";

// A screenshot we can't use is an expected outcome, not a server error:
// answer 200 so the browser console stays clean, and let the page explain.
function fail(error: EntryErrorCode) {
  return Response.json({ error });
}

// POST multipart { screenshot } → { draft } for the user to check before
// saving, or { error }. The model identifies the product, fills in details
// with web search, and points at the product photo, which we crop and keep.
export async function POST(request: Request) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const form = await request.formData().catch(() => null);
  const file = form?.get("screenshot");
  if (!(file instanceof Blob) || file.size === 0) return fail("no_file");
  const shot = await readScreenshot(file);
  if ("error" in shot) return fail(shot.error);

  let extracted;
  try {
    extracted = await extractItem({
      knownFields: {},
      images: [],
      screenshot: { kind: "inline", mime: shot.mime, base64: shot.data.toString("base64") },
      allowWebSearch: true,
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
  if (!extracted.recognized) return fail("unrecognized");
  // The closet holds clothes and shoes only.
  if (extracted.tags.category === "accessory") return fail("accessory");

  const photo = await productPhoto(shot, extracted.productBox);
  const db = createServerClient();
  const imagePaths = [await storeImage(db, writer.userId, photo.webp)];
  const lowConfidence = photo.cropped
    ? extracted.lowConfidence
    : [...extracted.lowConfidence, "image"];

  const draft: ItemDraft = {
    title: extracted.title,
    brand: extracted.brand,
    priceCents: extracted.priceCents,
    currency: extracted.currency,
    tags: extracted.tags,
    onModel: extracted.onModel,
    lowConfidence,
    webSources: extracted.sources,
    imagePaths,
    imageUrls: await signImages(db, imagePaths),
    rawSource: {
      screenshot: { width: shot.width, height: shot.height, mime: shot.mime },
      productBox: extracted.productBox ?? null,
      cropped: photo.cropped,
      webSources: extracted.sources,
      lowConfidence,
      extractedAt: new Date().toISOString(),
    },
  };
  return Response.json({ draft });
}
