import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { judgePairing, judgeRepeat, scorePurchase } from "@/lib/ai";
import { runBuyCheck } from "@/lib/check/buy-check";
import { itemTags } from "@/lib/closet/tags";
import { createServerClient } from "@/lib/db/server";
import { RESALE_SCORE_THRESHOLD } from "@/lib/resale/matches";
import buyers from "@/seed/buyers.json";
import items from "@/seed/items.json";

// The seed's sample buyers, copied under fresh ids (the shared database may
// hold the seeded ones), checked against the persona's passing-on pieces with
// the mock models: each piece has one strong match and some weaker ones.
const db = createServerClient();
const ids = new Map([...buyers.users, ...buyers.items, ...buyers.feelings].map((r) => [r.id, randomUUID()]));
const copy = (id: string) => ids.get(id)!;
const byName = (name: string) => copy(buyers.users.find((b) => b.display_name === `Sample buyer ${name}`)!.id);

beforeAll(async () => {
  await db
    .from("users")
    .insert(buyers.users.map((u) => ({ ...u, id: copy(u.id), resale_opt_in: false })))
    .throwOnError();
  await db
    .from("items")
    .insert(buyers.items.map((i) => ({ ...i, id: copy(i.id), user_id: copy(i.user_id) })))
    .throwOnError();
  await db
    .from("item_feelings")
    .insert(buyers.feelings.map((f) => ({ ...f, id: copy(f.id), item_id: copy(f.item_id), user_id: copy(f.user_id) })))
    .throwOnError();
});

afterAll(async () => {
  await db
    .from("users")
    .delete()
    .in("id", buyers.users.map((u) => copy(u.id)))
    .throwOnError();
});

async function score(buyerId: string, title: string) {
  const piece = items.find((i) => i.title === title)!;
  const check = await runBuyCheck(db, buyerId, { title, tags: itemTags(piece) }, {
    judge: judgePairing,
    score: scorePurchase,
    repeat: judgeRepeat,
  });
  return check && "result" in check ? check.result.score : null;
}

const CASES = [
  { title: "100% Cotton Crew Baby Tee", strong: "Maya" },
  { title: "Fleece Shortie Shorts", strong: "Jordan" },
];

describe("seed sample buyers", () => {
  for (const { title, strong } of CASES) {
    it(`have one strong match for the persona's ${title}`, async () => {
      expect(await score(byName(strong), title)).toBeGreaterThanOrEqual(RESALE_SCORE_THRESHOLD);
      for (const other of ["Maya", "Jordan", "Priya", "Lena"].filter((n) => n !== strong)) {
        expect(await score(byName(other), title)).toBeLessThan(RESALE_SCORE_THRESHOLD);
      }
    });
  }
});
