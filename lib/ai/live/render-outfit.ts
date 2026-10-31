import { z } from "zod";
import { boardLayout, type BoardBox } from "../../check/board-layout";
import { PRICE_PER_IMAGE, recordSpend } from "../budget";
import { AiNotConfiguredError, AiUpstreamError } from "../errors";
import type { Category } from "../schemas/common";
import type { RenderOutfitInput, RenderOutfitOutput } from "../schemas/render-outfit";
import { META_API_BASE_URL } from "./client";
import { getMetaApiKey } from "./key";
import { IMAGE_MODEL } from "./segment-garment";

// A whole board took 14.2 s on "high" in the small test, and the result was
// checked by eye; "low" was never tried on a board. Same price either way.
export const BOARD_REASONING_STRENGTH = "high";

const TIMEOUT_MS = 120_000;
const RETRY_DELAY_MS = 1000;

const ROLES: Record<Category, string> = {
  top: "the top",
  bottom: "the bottom",
  one_piece: "the one-piece",
  shoes: "the shoes",
  outerwear: "the outer layer",
  accessory: "the accessory",
};

export const BOARD_RULES =
  "Rules: pure white background (#FFFFFF), no shadows, no floor, no props. Each item cut out on its own, not touching or overlapping, with white space around it, at realistic relative sizes, front view. Copy every item exactly from its photo: same colors, pattern, fabric, buttons, logo and cut; do not redesign, restyle or add anything. No person, no model, no mannequin, no body parts, no skin, no hair. No text, no labels, no watermark. Portrait 4:5.";

// The part of a Responses API answer we read: the image tool's call.
const ImageResponse = z.object({
  output: z.array(z.object({ type: z.string(), result: z.string().nullish() })),
});

export function responsesUrl(): string {
  return `${META_API_BASE_URL}/responses`;
}

// Where a box sits on the board in words, e.g. "upper left".
export function placement(box: BoardBox): string {
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const across = x < 40 ? "left" : x > 60 ? "right" : "center";
  const down = y < 35 ? "upper" : y > 65 ? "lower" : "middle";
  return down === "middle" && across === "center" ? "in the center" : `${down} ${across}`;
}

// Text and photos take turns, one line before each photo, so the model knows
// which photo is which piece. Places follow the real board's layout, so the
// two look alike when the page switches between them.
export function boardRequest(input: z.output<typeof RenderOutfitInput>) {
  const boxes = boardLayout(input.items.map((i) => i.category));
  const content = [
    {
      type: "input_text",
      text: `Make an outfit board: a flat-lay collage of exactly these ${input.items.length} clothing items, nothing else.`,
    },
    ...input.items.flatMap((item, i) => {
      const { image } = item;
      if (image.kind === "storage") {
        throw new AiNotConfiguredError("renderOutfit", "live mode takes inline or URL images only");
      }
      return [
        {
          type: "input_text",
          text: `Item ${i + 1}, ${ROLES[item.category]}: ${item.description}. Place it ${placement(boxes[i])}.`,
        },
        { type: "input_image", image_url: image.kind === "url" ? image.url : `data:${image.mime};base64,${image.base64}` },
      ];
    }),
    { type: "input_text", text: BOARD_RULES },
  ];
  // Web search, image search and the code tool are all off: the photos are
  // the only reference. No `size`: the tool answers 400 to it.
  return {
    model: IMAGE_MODEL,
    store: false,
    input: [{ role: "user", content }],
    tools: [
      {
        type: "image_generation",
        enable_web_search: false,
        enable_image_search: false,
        enable_shell: false,
        reasoning_strength: BOARD_REASONING_STRENGTH,
        output_format: "png",
      },
    ],
  };
}

// One Muse Image board through the Responses API's image tool. Uses fetch:
// the openai SDK's tool type has no `enable_*` switches. A 429, a 5xx or a
// network error is retried once; a refusal (400) is not.
export async function liveRenderOutfit(
  input: z.output<typeof RenderOutfitInput>,
): Promise<z.input<typeof RenderOutfitOutput> | null> {
  const request = boardRequest(input);
  const apiKey = await getMetaApiKey();
  if (!apiKey) throw new AiNotConfiguredError("renderOutfit", "no Meta API key found");

  const body = JSON.stringify(request);
  const send = () =>
    fetch(responsesUrl(), {
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
  if (!res?.ok) throw new AiUpstreamError("renderOutfit", res?.status);

  const parsed = ImageResponse.safeParse(await res.json().catch(() => null));
  const images = parsed.success
    ? parsed.data.output.flatMap((o) => (o.type === "image_generation_call" && o.result ? [o.result] : []))
    : [];
  if (images.length === 0) return null;
  // Billed per returned image.
  await recordSpend(PRICE_PER_IMAGE * images.length);
  const prompt = request.input[0].content.flatMap((c) => ("text" in c ? [c.text] : [])).join("\n");
  return { image: { mime: "image/png", base64: images[0] }, prompt };
}
