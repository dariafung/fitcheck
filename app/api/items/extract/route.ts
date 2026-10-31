import { aiErrorResponse, extractItem } from "@/lib/ai";
import { requireWriter } from "@/lib/auth/guard";
import { createServerClient } from "@/lib/db/server";
import { alignBrand } from "@/lib/entry/brands";
import type { EntryErrorCode, ItemDraft } from "@/lib/entry/draft";
import { frameOriginal, needsCutout } from "@/lib/entry/frame";
import { signImages, storeImage } from "@/lib/entry/images";
import { savedBrands } from "@/lib/entry/saved-brands";
import { productPhoto, readScreenshot } from "@/lib/entry/screenshot";
import { cleanTitle } from "@/lib/entry/title";

// A screenshot we can't use is an expected outcome, not a server error:
// answer 200 so the browser console stays clean, and let the page explain.
function fail(error: EntryErrorCode) {
  return Response.json({ error });
}

// POST multipart { screenshot } → { draft } for the user to check before
// saving, or { error }. The model identifies the product, fills in details
// with web search, and points at the product photo, which we crop and keep.
// The brand is written the way the user (or the built-in list) writes it,
// and the name is cleaned of store notes, marks and the brand.
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
  // A flat-lay or ghost-mannequin photo is framed on white here, for free. An
  // on-model one, or one whose backdrop can't be turned white for free, is
  // kept as cropped for the model to cut out (/api/items/cutout).
  const cutOut = extracted.onModel || (await needsCutout(photo.webp));
  const webp = cutOut ? photo.webp : await frameOriginal(photo.webp);
  const db = createServerClient();
  const imagePaths = [await storeImage(db, writer.userId, webp)];
  const lowConfidence = photo.cropped
    ? extracted.lowConfidence
    : [...extracted.lowConfidence, "image"];

  const draft: ItemDraft = {
    title: cleanTitle(extracted.title, extracted.brand),
    brand: alignBrand(extracted.brand, await savedBrands(db, writer.userId)),
    priceCents: extracted.priceCents,
    currency: extracted.currency,
    size: extracted.size,
    tags: extracted.tags,
    onModel: extracted.onModel,
    cutOut,
    lowConfidence,
    webSources: extracted.sources,
    imagePaths,
    imageUrls: await signImages(db, imagePaths),
    rawSource: {
      screenshot: { width: shot.width, height: shot.height, mime: shot.mime },
      productBox: extracted.productBox ?? null,
      aiTitle: extracted.title,
      aiBrand: extracted.brand ?? null,
      aiSize: extracted.size ?? null,
      cropped: photo.cropped,
      webSources: extracted.sources,
      lowConfidence,
      extractedAt: new Date().toISOString(),
    },
  };
  return Response.json({ draft });
}
