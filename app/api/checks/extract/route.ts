import { aiErrorResponse, extractItem } from "@/lib/ai";
import type { EntryErrorCode, ItemDraft } from "@/lib/entry/draft";
import { productPhoto, readScreenshot } from "@/lib/entry/screenshot";

// A screenshot we can't use is an expected outcome: answer 200 so the
// browser console stays clean, and let the page explain.
function fail(error: EntryErrorCode) {
  return Response.json({ error });
}

// POST multipart { screenshot } → { draft } for the user to check, or
// { error }. Same steps as /api/items/extract, but nothing is stored: the
// item may never be bought, so the cropped photo goes back inline as a data
// URL and lives only in the page.
export async function POST(request: Request) {
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

  const photo = await productPhoto(shot, extracted.productBox);
  const draft: ItemDraft = {
    title: extracted.title,
    brand: extracted.brand,
    priceCents: extracted.priceCents,
    currency: extracted.currency,
    tags: extracted.tags,
    onModel: extracted.onModel,
    lowConfidence: photo.cropped ? extracted.lowConfidence : [...extracted.lowConfidence, "image"],
    webSources: extracted.sources,
    imagePaths: [],
    imageUrls: [`data:image/webp;base64,${photo.webp.toString("base64")}`],
    rawSource: {},
  };
  return Response.json({ draft });
}
