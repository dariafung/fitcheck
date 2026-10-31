// The persona as the seed writes it, for recording its style card and its
// outfit log insights: the same inputs home and the calendar build from the
// seeded database. seed/style-profile.json is copied from the card recorded
// here; the insights stay a runtime cache.
import type { BuildProfileInput } from "@/lib/ai/schemas/build-profile";
import { FeelingStructured, type LifestyleMix } from "@/lib/ai/schemas/common";
import type { SummarizeWearInput } from "@/lib/ai/schemas/summarize-wear";
import { itemTags } from "@/lib/closet/tags";
import { profileInput } from "@/lib/closet/style-profile";
import { chicagoDay } from "@/lib/wear/day";
import { wearInput } from "@/lib/wear/insights";
import type { WearLogItem } from "@/lib/wear/log";
import { wearStats, wearWindow, type LoggedOutfit } from "@/lib/wear/stats";
import { addDays, SEED_DAYS, seedOutfitLog } from "../../scripts/lib/wear-seed.mjs";
import feelings from "../../seed/feelings.json";
import items from "../../seed/items.json";
import persona from "../../seed/persona.json";
import wearPlan from "../../seed/wear-plan.json";

export function personaProfileInput(): BuildProfileInput {
  const input = profileInput(
    items.filter((i) => i.status === "active"),
    feelings,
  );
  if (!input) throw new Error("the persona has too few feelings for a card");
  return input;
}

// Any day works: the log only goes in as counts and days back. Items are
// owned from SEED_DAYS before it, as scripts/seed.mts writes them.
const LAST_DAY = "2026-10-30";

export function personaWearInput(): SummarizeWearInput {
  const ownedSince = chicagoDay(new Date(`${addDays(LAST_DAY, -SEED_DAYS)}T12:00:00Z`));
  const felt = new Map(feelings.map((f) => [f.item_id, FeelingStructured.parse(f.structured)]));
  const logItems: WearLogItem[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    status: item.status,
    addedOn: ownedSince,
    feeling: felt.get(item.id) ?? null,
    tags: itemTags(item),
  }));
  const { rows } = seedOutfitLog({
    personaId: persona.id,
    items,
    feelings,
    lifestyleMix: persona.lifestyle_mix,
    plan: wearPlan,
    lastDay: LAST_DAY,
  });
  const outfits: LoggedOutfit[] = rows.map((r: { id: string; worn_on: string; item_ids: string[]; occasion: string | null }) => ({
    id: r.id,
    date: r.worn_on,
    itemIds: r.item_ids,
    occasion: r.occasion as LoggedOutfit["occasion"],
  }));
  const window = wearWindow(outfits.at(-1)?.date ?? null);
  if (!window) throw new Error("the persona has no outfit log");
  const stats = wearStats(outfits, logItems, persona.lifestyle_mix as LifestyleMix, window);
  const input = wearInput({ items: logItems, outfits, stats });
  if (!input) throw new Error("the persona has too short a log for insights");
  return input;
}
