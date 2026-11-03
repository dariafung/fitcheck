import { aiErrorResponse, extractItem } from "@/lib/ai";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { alignBrand } from "@/lib/entry/brands";
import type { EntryErrorCode, ItemDraft } from "@/lib/entry/draft";
import { frameOriginal } from "@/lib/entry/frame";
import { savedBrands } from "@/lib/entry/saved-brands";
import { productPhoto, readScreenshot } from "@/lib/entry/screenshot";
import { cleanTitle } from "@/lib/entry/title";
import { withDaily } from "@/lib/limits/daily";

// A screenshot we can't use is an expected outcome: answer 200 so the
// browser console stays clean, and let the page explain.
function fail(error: EntryErrorCode) {
  return Response.json({ error });
}

// POST multipart { screenshot } → { draft } for the user to check, or
// { error }. Same steps as /api/items/extract, but nothing is stored: the
// item may never be bought, so the framed photo goes back inline as a data
// URL and lives only in the page.
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("screenshot");
  if (!(file instanceof Blob) || file.size === 0) return fail("no_file");
  const shot = await readScreenshot(file);
  if ("error" in shot) return fail(shot.error);

  let extracted;
  try {
    extracted = await withDaily("read", () =>
      extractItem({
        knownFields: {},
        images: [],
        screenshot: { kind: "inline", mime: shot.mime, base64: shot.data.toString("base64") },
        allowWebSearch: true,
      }),
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
  if (!extracted.recognized) return fail("unrecognized");

  const photo = await productPhoto(shot, extracted.productBox);
  // Framed like a stored item photo, for free: a plain light backdrop goes
  // white and the garment is centered, so the page shows (and the check
  // scores) the piece rather than the padded crop with the page around it.
  // An on-model photo is then cut out by the page (/api/checks/cutout).
  const framed = await frameOriginal(photo.webp, photo.probe);
  const draft: ItemDraft = {
    title: cleanTitle(extracted.title, extracted.brand),
    brand: alignBrand(extracted.brand, await savedBrands(createServerClient(), await currentUserId())),
    priceCents: extracted.priceCents,
    currency: extracted.currency,
    tags: extracted.tags,
    onModel: extracted.onModel,
    lowConfidence: photo.cropped ? extracted.lowConfidence : [...extracted.lowConfidence, "image"],
    webSources: extracted.sources,
    imagePaths: [],
    imageUrls: [`data:image/webp;base64,${framed.toString("base64")}`],
    rawSource: {},
  };
  return Response.json({ draft });
}
