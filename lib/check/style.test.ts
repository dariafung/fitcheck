import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { RenderOutfitInput } from "../ai/schemas/render-outfit";
import { CANDIDATE_ITEM_ID } from "./pairings";
import { candidatePiece, REFERENCE_MAX_SIDE, sortPieces, styleInput, type StylePiece } from "./style";

const tags = (category: StylePiece["category"]) => ({
  category,
  colors: [{ name: "navy", hex: "#14204f" }],
  materials: [],
  formality: 3,
  occasions: [],
});

// A see-through PNG, so flattening onto white shows.
function photo(width = 200, height = 250): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png()
    .toBuffer();
}

async function piece(id: string, category: StylePiece["category"], withTags = true): Promise<StylePiece> {
  return { id, title: `Item ${id}`, category, tags: withTags ? tags(category) : null, photo: await photo() };
}

describe("sortPieces", () => {
  it("goes top to toe, the layer and shoes last", () => {
    const order = sortPieces([{ category: "shoes" }, { category: "outerwear" }, { category: "bottom" }, { category: "top" }] as const);
    expect(order.map((p) => p.category)).toEqual(["top", "bottom", "outerwear", "shoes"]);
    expect(sortPieces([{ category: "shoes" }, { category: "one_piece" }] as const).map((p) => p.category)).toEqual([
      "one_piece",
      "shoes",
    ]);
  });
});

describe("styleInput", () => {
  it("builds a renderOutfit input with the candidate under its fixed id", async () => {
    const candidate = candidatePiece("New shoes", tags("shoes"), await photo());
    const input = await styleInput([candidate, await piece("a", "bottom"), await piece("b", "top")]);
    expect(RenderOutfitInput.safeParse({ items: input.items.map((i) => ({ ...i, id: crypto.randomUUID() })) }).success).toBe(true);
    expect(input.items.map((i) => [i.id, i.category])).toEqual([
      ["b", "top"],
      ["a", "bottom"],
      [CANDIDATE_ITEM_ID, "shoes"],
    ]);
    expect(input.items[2].description).toBe("New shoes: shoes; colors navy; formality 3/5");
  });

  it("describes a piece by its title when its tags can't be read", async () => {
    const input = await styleInput([await piece("a", "one_piece", false), await piece("b", "shoes")]);
    expect(input.items[0].description).toBe("Item a");
  });

  it("sends each photo as a PNG on white, no bigger than the limit", async () => {
    const big = { ...(await piece("a", "top")), photo: await photo(3000, 2000) };
    const input = await styleInput([big, await piece("b", "shoes")]);
    const image = input.items[0].image;
    if (image.kind !== "inline") throw new Error("expected an inline image");
    expect(image.mime).toBe("image/png");
    const png = sharp(Buffer.from(image.base64, "base64"));
    const meta = await png.metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(REFERENCE_MAX_SIDE);
    expect(meta.hasAlpha).toBe(false);
    const { data } = await png.raw().toBuffer({ resolveWithObject: true });
    expect([...data.subarray(0, 3)]).toEqual([255, 255, 255]);
  });
});
