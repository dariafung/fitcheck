import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/checks/route";
import * as ai from "@/lib/ai";
import { MOCK_INCOMPLETE_TITLE } from "@/lib/ai/mock/score-purchase";
import type { ItemTags } from "@/lib/ai/schemas/common";
import type { BuyCheck, BuyCheckResult } from "@/lib/check/buy-check";
import { FIT_QUESTIONS } from "@/lib/check/fit-questions";
import { CANDIDATE_ITEM_ID } from "@/lib/check/pairings";
import { ACCESSORY_NOTICE, INCOMPLETE_ERROR, INCOMPLETE_NOTICE, NO_LIFESTYLE_REASON } from "@/lib/check/reasons";
import { roundPart } from "@/lib/check/score";
import { PLACEHOLDER_VERSION } from "@/lib/closet/style-profile";
import { createServerClient } from "@/lib/db/server";
import { ITEM_IMAGES_BUCKET } from "@/lib/entry/images";
import sharp from "sharp";

// Spies on the model calls while keeping the mock answers.
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return {
    ...actual,
    judgePairing: vi.fn(actual.judgePairing),
    judgeRepeat: vi.fn(actual.judgeRepeat),
    scorePurchase: vi.fn(actual.scorePurchase),
  };
});

const current = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => current.userId }));

// A tiny closet with no shoes: a pair of shoes closes the gap, a formal
// skirt creates one. Rows use random ids and go away with the user.
const db = createServerClient();
const userId = randomUUID();
current.userId = userId;
const shirtId = randomUUID();
const trousersId = randomUUID();

function tags(over: Partial<ItemTags> & Pick<ItemTags, "category">): ItemTags {
  return { colors: [], materials: [], formality: 3, occasions: ["work"], ...over };
}

// Wants 3 work outfits a season and has none (no shoes yet).
const MIX = { work: 3, school: 0, social: 1, sport: 0, home: 0 };

const LOAFERS = { title: "Black loafers", tags: tags({ category: "shoes", colorFamily: "black" }) };
const SEQUIN_SKIRT = {
  title: "Pink sequin skirt",
  tags: tags({ category: "bottom", colorFamily: "pink", formality: 5, occasions: ["social"] }),
};

async function check(body: unknown, expectStatus = 200): Promise<BuyCheck> {
  const res = await POST(
    new Request("http://localhost/api/checks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  expect(res.status).toBe(expectStatus);
  return res.json();
}

async function result(body: unknown): Promise<BuyCheckResult> {
  const json = await check(body);
  if (!("result" in json)) throw new Error("expected a result");
  return json.result;
}

async function rowCounts() {
  const items = await db.from("items").select("id", { count: "exact", head: true }).eq("user_id", userId);
  const pairings = await db
    .from("pairings")
    .select("item_a_id, item_b_id")
    .eq("user_id", userId)
    .throwOnError();
  return { items: items.count, pairings: pairings.data };
}

beforeAll(async () => {
  await db
    .from("users")
    .insert({
      id: userId,
      display_name: "Buy check test",
      body_shape: "pear",
      lifestyle_mix: MIX,
    })
    .throwOnError();
  await db
    .from("items")
    .insert([
      { id: shirtId, title: "White shirt", ai_tags: tags({ category: "top", colorFamily: "white" }) },
      { id: trousersId, title: "Black trousers", ai_tags: tags({ category: "bottom", colorFamily: "black" }) },
    ].map((item) => ({ ...item, user_id: userId, entry_method: "manual", category: item.ai_tags.category })))
    .throwOnError();
  await db
    .from("item_feelings")
    .insert([
      {
        item_id: shirtId,
        user_id: userId,
        raw_text: "Love it, flattering, but it pulls at the hips",
        source: "typed",
        structured: {
          flattering: "yes",
          liked: "yes",
          aspects: [{ aspect: "fit", sentiment: "negative", area: "hips", said: "pulls at the hips", means: "hips need room" }],
          occasions: [],
          mood: ["confident"],
          summary: "Loves it.",
        },
      },
      {
        item_id: trousersId,
        user_id: userId,
        raw_text: "The black washes me out",
        source: "typed",
        structured: {
          flattering: "no",
          liked: "unknown",
          aspects: [{ aspect: "color", sentiment: "negative", said: "black washes me out", means: "black is too harsh" }],
          occasions: [],
          mood: [],
          summary: "Black washes them out.",
        },
      },
    ])
    .throwOnError();
});

afterAll(async () => {
  await db.from("users").delete().eq("id", userId).throwOnError();
});

beforeEach(() => {
  vi.mocked(ai.judgePairing).mockClear();
  vi.mocked(ai.judgeRepeat).mockClear();
  vi.mocked(ai.scorePurchase).mockClear();
});

describe("POST /api/checks", () => {
  it("scores an item that closes a gap", async () => {
    const r = await result(LOAFERS);
    expect(r.parts.outfits).toMatchObject({ count: 1, points: 2.5 });
    expect(r.parts.revives.items.map((i) => i.id).sort()).toEqual([shirtId, trousersId].sort());
    expect(r.parts.revives.points).toBe(8);
    // Work: 3 of 3 short, adds 1.
    expect(r.parts.fillsGap).toMatchObject({ tier: "from_zero", points: 5, reason: "You want 3 work outfits and have 0. This adds 1." });
    expect(r.parts.notRepeat).toMatchObject({ points: 10, item: null });
    expect(r.gap).toBeNull();
    expect(r.sampleOutfits).toHaveLength(1);
    expect(r.sampleOutfits[0].pieces.map((p) => [p.title, p.isCandidate])).toEqual([
      ["White shirt", false],
      ["Black trousers", false],
      ["Black loafers", true],
    ]);
    expect(r.score).toBe(roundPart(Object.values(r.parts).reduce((s, p) => s + p.points, 0)));

    // Every question had something to compare against.
    expect(r.parts.suitsYou.answers).toHaveLength(FIT_QUESTIONS.length);
    expect(r.parts.suitsYou.answers.every((a) => a.score !== null)).toBe(true);
    const [input] = vi.mocked(ai.scorePurchase).mock.calls[0];
    expect(input.troubleAreas).toEqual(["hips"]);
    // Every felt item goes in, the one they dislike too.
    expect(input.feltItems).toHaveLength(2);
    expect(input.feltItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: shirtId, feeling: expect.objectContaining({ flattering: "yes", mood: ["confident"] }) }),
        expect.objectContaining({
          id: trousersId,
          feeling: expect.objectContaining({ flattering: "no", aspects: [expect.objectContaining({ aspect: "color" })] }),
        }),
      ]),
    );
    expect(input.profile).toMatchObject({ bodyShape: "pear", lifestyleMix: MIX });
    // The repeat check sees the whole closet.
    const [repeatInput] = vi.mocked(ai.judgeRepeat).mock.calls[0];
    expect(repeatInput.closet.map((i) => i.id).sort()).toEqual([shirtId, trousersId].sort());
  });

  it("scores an item that creates a gap and says what's missing", async () => {
    const r = await result(SEQUIN_SKIRT);
    expect(r.parts.outfits.count).toBe(0);
    expect(r.parts.revives.items).toEqual([]);
    expect(r.parts.fillsGap.tier).toBe("none");
    // The shirt was never judged against it (no shoes, so no outfit to judge
    // for), so only the shoes count as missing.
    expect(r.gap).toEqual({
      kind: "nothing_owned",
      slots: [[{ category: "shoes", owned: false }]],
      reason: "Your tops could go with this, but you have no shoes yet.",
    });
    expect(r.sampleOutfits).toEqual([]);
  });

  it("stores nothing about the item and asks the model every time", async () => {
    const before = await rowCounts();
    const runs = [await result(LOAFERS), await result(LOAFERS), await result(LOAFERS)];
    const after = await rowCounts();

    expect(after.items).toBe(before.items);
    const ids = after.pairings.flatMap((p) => [p.item_a_id, p.item_b_id]);
    expect(ids).not.toContain(CANDIDATE_ITEM_ID);
    expect(runs.map((r) => r.stats.cached)).toEqual([1, 1, 1]);
    expect(runs.every((r) => r.stats.judged === 2)).toBe(true);
    expect(vi.mocked(ai.scorePurchase)).toHaveBeenCalledTimes(3);
    expect(vi.mocked(ai.judgeRepeat)).toHaveBeenCalledTimes(3);
    // Mock answers depend only on the input, so the score repeats.
    expect(new Set(runs.map((r) => r.score)).size).toBe(1);
  });

  it("finds near duplicates", async () => {
    const r = await result({ title: "Another white shirt", tags: tags({ category: "top", colorFamily: "white" }) });
    expect(r.parts.notRepeat).toMatchObject({ points: 4, item: { id: shirtId, title: "White shirt" } });
  });

  it("doesn't score accessories", async () => {
    const json = await check({ title: "Gold hoops", tags: tags({ category: "accessory" }) });
    expect(json).toEqual({ unsupported: "accessory", message: ACCESSORY_NOTICE });
    expect(ai.judgePairing).not.toHaveBeenCalled();
    expect(ai.scorePurchase).not.toHaveBeenCalled();
    expect(ai.judgeRepeat).not.toHaveBeenCalled();
  });

  it("gives no score when the model never answers every question", async () => {
    const json = await check({ title: MOCK_INCOMPLETE_TITLE, tags: LOAFERS.tags });
    expect(json).toEqual({ error: INCOMPLETE_ERROR, message: INCOMPLETE_NOTICE });
  });

  it("rejects an invalid item", async () => {
    await check({ title: "", tags: {} }, 400);
    await check("not json", 400);
  });

  it("answers 404 when the current user doesn't exist", async () => {
    current.userId = randomUUID();
    try {
      await check(LOAFERS, 404);
    } finally {
      current.userId = userId;
    }
  });

  it("leaves the gap at 0 without a lifestyle mix in the current format", async () => {
    await db
      .from("users")
      .update({ lifestyle_mix: { work: 50, social: 20, sport: 15, home: 15 } })
      .eq("id", userId)
      .throwOnError();
    try {
      const r = await result(LOAFERS);
      expect(r.parts.fillsGap).toMatchObject({ points: 0, reason: NO_LIFESTYLE_REASON });
    } finally {
      await db
        .from("users")
        .update({
          lifestyle_mix: MIX,
        })
        .eq("id", userId)
        .throwOnError();
    }
  });

  describe("with a style card", () => {
    const goneId = randomUUID();
    const statement = (topic: string, text: string, ids: string[]) => ({ topic, text, evidenceItemIds: ids });
    // Built for an older closet: stale, and one line is about an item that's gone.
    const CARD = {
      headline: { text: "Easy basics.", evidenceItemIds: [shirtId, trousersId] },
      suits: [
        statement("color", "Light colors.", [shirtId]),
        statement("feel", "Soft cotton.", [shirtId]),
        statement("style", "Bold prints.", [goneId]),
        statement("occasion", "Mostly work.", [shirtId, trousersId]),
      ],
      avoid: [statement("fit", "Tight hips.", [shirtId])],
      input_hash: "an older closet",
      prompt_version: "build-profile@3",
    };
    const saveCard = (card: Record<string, unknown>) =>
      db.from("style_profiles").upsert({ user_id: userId, ...card }, { onConflict: "user_id" }).throwOnError();
    const scoreInput = async () => {
      vi.mocked(ai.scorePurchase).mockClear();
      await result(LOAFERS);
      return vi.mocked(ai.scorePurchase).mock.calls[0][0];
    };

    afterEach(async () => {
      await db.from("style_profiles").delete().eq("user_id", userId).throwOnError();
    });

    it("sends the card's lines, stale too, without occasions or lines about items that are gone", async () => {
      const without = await scoreInput();
      await saveCard(CARD);
      const input = await scoreInput();
      expect(input.styleProfile).toEqual([
        { topic: "color", kind: "suits", text: "Light colors." },
        { topic: "fit", kind: "avoid", text: "Tight hips." },
        { topic: "feel", kind: "suits", text: "Soft cotton." },
      ]);
      expect({ ...input, styleProfile: undefined }).toEqual(without);
    });

    it("sends the same input as without a card for the placeholder or a card too thin to show", async () => {
      const without = await scoreInput();
      expect(without).not.toHaveProperty("styleProfile");
      await saveCard({ ...CARD, prompt_version: PLACEHOLDER_VERSION });
      expect(await scoreInput()).toEqual(without);
      // Only the headline, color and occasion rows are left.
      await saveCard({ ...CARD, suits: CARD.suits.filter((x) => x.topic === "color" || x.topic === "occasion"), avoid: [] });
      expect(await scoreInput()).toEqual(without);
    });
  });

  describe("with photos", () => {
    const shirtPhoto = `${userId}/${randomUUID()}.webp`;
    const shot = () =>
      sharp({ create: { width: 900, height: 1200, channels: 3, background: "#ffffff" } }).webp().toBuffer();

    beforeAll(async () => {
      const { error } = await db.storage.from(ITEM_IMAGES_BUCKET).upload(shirtPhoto, await shot(), { contentType: "image/webp" });
      if (error) throw error;
      await db.from("items").update({ image_paths: [shirtPhoto] }).eq("id", shirtId).throwOnError();
    });

    afterAll(async () => {
      await db.from("items").update({ image_paths: [] }).eq("id", shirtId).throwOnError();
      await db.storage.from(ITEM_IMAGES_BUCKET).remove([shirtPhoto]);
    });

    const scoreInput = async (body: unknown) => {
      vi.mocked(ai.scorePurchase).mockClear();
      await result(body);
      return vi.mocked(ai.scorePurchase).mock.calls[0][0];
    };

    it("sends the item's photo and the felt items' stored photos, shrunk", async () => {
      const input = await scoreInput({ ...LOAFERS, photo: `data:image/webp;base64,${(await shot()).toString("base64")}` });
      const photo = input.candidate.photo;
      if (photo?.kind !== "inline") throw new Error("expected an inline photo");
      expect(await sharp(Buffer.from(photo.base64, "base64")).metadata()).toMatchObject({ format: "webp", height: 512 });
      const felt = new Map(input.feltItems.map((f) => [f.id, f.photo]));
      expect(felt.get(shirtId)).toMatchObject({ kind: "inline", mime: "image/webp" });
      // The trousers have no photo and go as text.
      expect(felt.has(trousersId)).toBe(true);
      expect(felt.get(trousersId)).toBeUndefined();
    });

    it("scores by the tags when the item's photo can't be read", async () => {
      for (const photo of ["not a data url", `data:image/png;base64,${Buffer.from("hello").toString("base64")}`]) {
        const input = await scoreInput({ ...LOAFERS, photo });
        expect(input.candidate).not.toHaveProperty("photo");
      }
    });
  });
});
