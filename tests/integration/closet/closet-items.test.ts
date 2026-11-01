import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ITEM_IMAGES_BUCKET } from "@/lib/closet/images";
import { listClosetItems } from "@/lib/closet/items";
import { FALLBACK_SWATCH } from "@/lib/closet/swatch";
import { COLOR_FAMILY_HEX } from "@/lib/color-families";
import { createTestCloset } from "./helpers";

// 1x1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

let closet: Awaited<ReturnType<typeof createTestCloset>>;
const imagePath = `tests/${randomUUID()}.png`;

beforeEach(async () => {
  closet = await createTestCloset();
});

afterEach(async () => {
  await closet.db.storage.from(ITEM_IMAGES_BUCKET).remove([imagePath]);
  await closet.cleanup();
});

describe("listClosetItems", () => {
  it("lists owned items with a signed or external cover image", async () => {
    const { error } = await closet.db.storage
      .from(ITEM_IMAGES_BUCKET)
      .upload(imagePath, PNG, { contentType: "image/png" });
    expect(error).toBeNull();
    await closet.db.from("items").update({ image_paths: [imagePath] }).eq("id", closet.itemId).throwOnError();
    await closet.db
      .from("items")
      .insert({
        user_id: closet.userId,
        entry_method: "link",
        title: "Linked loafers",
        category: "shoes",
        image_paths: ["https://cdn.example.com/loafers.jpg"],
      })
      .throwOnError();

    const cards = await listClosetItems(closet.db, closet.userId);
    expect(cards.map((c) => c.title).sort()).toEqual(["Linked loafers", "Test linen shirt"]);

    const shirt = cards.find((c) => c.title === "Test linen shirt")!;
    expect(shirt).toMatchObject({
      swatch: COLOR_FAMILY_HEX.cream,
      status: "active",
      tempRangeF: { min: 65, max: 95 },
    });
    expect(shirt.imageUrl).toContain(`/object/sign/${ITEM_IMAGES_BUCKET}/${imagePath}`);
    const signed = await fetch(shirt.imageUrl!);
    expect(signed.status).toBe(200);

    const loafers = cards.find((c) => c.title === "Linked loafers")!;
    expect(loafers).toMatchObject({
      imageUrl: "https://cdn.example.com/loafers.jpg",
      swatch: FALLBACK_SWATCH,
      tempRangeF: null,
    });
  });

  it("notes the latest feeling's summary once it has been read, else nothing", async () => {
    const { data: other } = await closet.db
      .from("items")
      .insert({ user_id: closet.userId, entry_method: "manual", title: "Unread tee", category: "top" })
      .select("id")
      .single()
      .throwOnError();
    await closet.db
      .from("item_feelings")
      .insert([
        {
          item_id: closet.itemId,
          user_id: closet.userId,
          raw_text: "Boxy in the shoulders but I love the color.",
          source: "typed",
          structured: {
            flattering: "unknown",
            liked: "yes",
            aspects: [],
            occasions: [],
            mood: [],
            summary: "Loved color, boxy in the shoulders.",
          },
        },
        { item_id: other.id, user_id: closet.userId, raw_text: "Not read yet.", source: "typed" },
      ])
      .throwOnError();

    const cards = await listClosetItems(closet.db, closet.userId);
    expect(cards.find((c) => c.id === closet.itemId)?.note).toBe("Loved color, boxy in the shoulders.");
    expect(cards.find((c) => c.id === other.id)?.note).toBeNull();
  });

  it("is empty for a user with nothing yet", async () => {
    expect(await listClosetItems(closet.db, randomUUID())).toEqual([]);
  });
});
