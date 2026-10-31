import { z } from "zod";
import { PRICE_PER_IMAGE, recordSpend } from "../budget";
import { AiNotConfiguredError, AiUpstreamError } from "../errors";
import type { SegmentGarmentInput, SegmentGarmentOutput } from "../schemas/segment-garment";
import { META_API_BASE_URL } from "./client";
import { getMetaApiKey } from "./key";

export const IMAGE_MODEL = "muse-image-1.0";

// "low" stops after one pass, "high" refines over several; same price.
// On a real on-model photo low took 9.6 s and high 17.4 s, with no visible
// difference in the result.
export const REASONING_STRENGTH = "low";

const TIMEOUT_MS = 120_000;
const RETRY_DELAY_MS = 1000;

// The ImagesResponse part we read (dev.meta.ai/docs/api-reference/images/schemas).
const ImagesResponse = z.object({
  data: z.array(z.object({ b64_json: z.string().min(1) })).min(1),
});

export function imageEditsUrl(): string {
  return `${META_API_BASE_URL}/images/edits`;
}

export function segmentPrompt(input: z.output<typeof SegmentGarmentInput>): string {
  const garment = input.description ? `${input.category} (${input.description})` : input.category;
  return [
    `Product photo cleanup. Take only the ${garment} from the reference image and show it alone`,
    "on a pure white background (#FFFFFF), as a ghost-mannequin / flat-lay product shot, front view,",
    "centered, no shadow. Keep its exact colors, pattern, fabric, buttons, logo and cut.",
    "Remove every person, body part, skin, hair, hanger, prop and other garment. No text, no watermark.",
  ].join(" ");
}

// Web search, image search and the code tool are all off: the photo is the
// only reference the model gets.
export function segmentRequest(input: z.output<typeof SegmentGarmentInput>, imageUrl: string) {
  return {
    model: IMAGE_MODEL,
    prompt: segmentPrompt(input),
    images: [{ image_url: imageUrl }],
    n: 1,
    output_format: "png",
    response_format: "b64_json",
    reasoning_strength: REASONING_STRENGTH,
    tool_enablement: { enable_web_search: false, enable_image_search: false, enable_shell: false },
  };
}

// One Muse Image edit (POST /images/edits, JSON). The openai SDK only sends
// this endpoint as multipart, which has no `images` list, so this uses fetch.
// A 429, a 5xx or a network error is retried once; a refusal (400) is not.
export async function liveSegmentGarment(
  input: z.output<typeof SegmentGarmentInput>,
): Promise<z.input<typeof SegmentGarmentOutput> | null> {
  const { image } = input;
  if (image.kind === "storage") {
    throw new AiNotConfiguredError("segmentGarment", "live mode takes inline or URL images only");
  }
  const apiKey = await getMetaApiKey();
  if (!apiKey) throw new AiNotConfiguredError("segmentGarment", "no Meta API key found");

  const imageUrl = image.kind === "url" ? image.url : `data:${image.mime};base64,${image.base64}`;
  const body = JSON.stringify(segmentRequest(input, imageUrl));
  const send = () =>
    fetch(imageEditsUrl(), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  let res = await send().catch(() => null);
  if (!res || res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    res = await send().catch(() => null);
  }
  if (!res?.ok) throw new AiUpstreamError("segmentGarment", res?.status);

  const parsed = ImagesResponse.safeParse(await res.json().catch(() => null));
  if (!parsed.success) return null;
  // Billed per returned image.
  await recordSpend(PRICE_PER_IMAGE * parsed.data.data.length);
  return { image: { mime: "image/png", base64: parsed.data.data[0].b64_json } };
}
