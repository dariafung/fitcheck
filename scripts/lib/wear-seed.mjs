// The demo persona's outfit calendar: 10 days of outfits made up from
// whatever closet seed/items.json holds, so it keeps working when the closet
// changes. Same closet, same log: every choice comes from a fixed-seed PRNG.
//
// It tells a story on purpose. A piece the persona praises is worn once; a
// piece they complain about is worn a lot; a piece sits unworn; sport, which
// they want 3 different outfits for, always gets the same one.
// seed/wear-plan.json can pick those pieces by hand:
//   { "<item id>": "rare" | "often" | "never" }
// or write the whole log by hand, day by day (0 days ago is the last day):
//   { "days": [{ "daysAgo": 9, "outfits": [{ "items": ["<item id>"], "occasion": "school" }] }] }
import { createHash } from "node:crypto";

export const SEED_DAYS = 10;
// Days left blank, as people forget.
const SKIP_CHANCE = 0.12;
// Most days have one outfit; this share also get a second, for sport.
const SPORT_CHANCE = 0.3;
const OFTEN_WEIGHT = 10;
const WEIGHT_BY_LIKED = { yes: 1.5, mixed: 1, unknown: 1, no: 0.5 };
// Below this high (°F) a day gets outerwear when there is some.
const OUTERWEAR_BELOW_F = 55;
const RARE_DAY = 6;

/** @typedef {"rare" | "often" | "never"} Role */
/**
 * @typedef {{ id: string, title: string, status?: string, category: string,
 *   ai_tags: { formality?: number, occasions?: string[], tempRangeF?: { min: number, max: number } } }} SeedItem
 * @typedef {{ item_id: string, structured: { liked: string, flattering: string,
 *   aspects?: { sentiment: string }[] } }} SeedFeeling
 * @typedef {{ id: string, user_id: string, worn_on: string, item_ids: string[], occasion: string | null }} OutfitRow
 * @typedef {{ days: { daysAgo: number, outfits: { items: string[], occasion?: string | null }[] }[] }} DayPlan
 */

/** @param {string} seed */
function random(seed) {
  let state = Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A fixed UUID per persona, day and outfit, so reruns write the same ids.
/** @param {string} key */
function uuidFrom(key) {
  const h = createHash("sha256").update(key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** @param {string} date @param {number} days */
export function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The log's last day: `override` (SEED_LAST_DAY, YYYY-MM-DD) when given,
 * e.g. to pin the hosted demo's log to the hackathon's dates; otherwise
 * yesterday in Chicago, leaving today for the demo.
 * @param {string | undefined} override @param {Date} [now]
 */
export function seedLastDay(override, now = new Date()) {
  if (override) {
    const time = Date.parse(`${override}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(override) || Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== override) {
      throw new Error(`SEED_LAST_DAY must be a date as YYYY-MM-DD, got "${override}"`);
    }
    return override;
  }
  return addDays(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now), -1);
}

/**
 * A warning when the log would end after today in Chicago: those days are
 * written as future outfits, and the calendar's numbers skip them until
 * then. Null otherwise.
 * @param {string} lastDay @param {Date} [now]
 */
export function futureSeedWarning(lastDay, now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
  if (lastDay <= today) return null;
  return (
    `Warning: SEED_LAST_DAY ${lastDay} is after today (${today}), so outfits are written for future days ` +
    `and the calendar's numbers leave them out until then. Run the seed on or after ${lastDay}.`
  );
}

/** @param {SeedFeeling["structured"] | undefined} f */
const praises = (f) => !!f && f.liked === "yes" && f.flattering !== "no";
/** @param {SeedFeeling["structured"] | undefined} f */
const complains = (f) =>
  !!f && (f.liked === "no" || f.flattering === "no" || (f.liked !== "yes" && !!f.aspects?.some((a) => a.sentiment === "negative")));

/**
 * Which piece plays which part. A hand-made plan wins; otherwise the most
 * formal praised piece is "rare", a complained-about top, bottom or shoe is
 * "often", and in a big enough closet one unfelt piece that isn't the only
 * one of its kind is "never".
 * @param {SeedItem[]} items active items
 * @param {Map<string, SeedFeeling["structured"]>} felt
 * @param {Record<string, Role> | null} plan
 * @returns {Map<string, Role>}
 */
export function wearRoles(items, felt, plan) {
  if (plan) return new Map(Object.entries(plan).filter(([id]) => items.some((i) => i.id === id)));
  const roles = new Map();
  const formality = (/** @type {SeedItem} */ i) => i.ai_tags.formality ?? 0;
  const rare = items.filter((i) => praises(felt.get(i.id))).sort((a, b) => formality(b) - formality(a))[0];
  if (rare) roles.set(rare.id, "rare");
  const order = ["bottom", "shoes", "top"];
  const often = items
    .filter((i) => !roles.has(i.id) && order.includes(i.category) && complains(felt.get(i.id)))
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))[0];
  if (often) roles.set(often.id, "often");
  if (items.length >= 8) {
    const never = items.find(
      (i) => !roles.has(i.id) && !felt.has(i.id) && items.filter((o) => o.category === i.category).length > 1,
    );
    if (never) roles.set(never.id, "never");
  }
  return roles;
}

/**
 * The log exactly as a day-by-day plan writes it. Pieces that aren't in the
 * closet are dropped, and so is an outfit left empty or repeated that day.
 * Passed-on pieces may appear: they were worn before they were let go.
 * @param {string} personaId @param {SeedItem[]} items @param {DayPlan} plan @param {string} lastDay
 * @returns {OutfitRow[]}
 */
function plannedLog(personaId, items, plan, lastDay) {
  const ids = new Set(items.map((i) => i.id));
  /** @type {OutfitRow[]} */
  const rows = [];
  for (const day of [...plan.days].sort((a, b) => b.daysAgo - a.daysAgo)) {
    if (day.daysAgo < 0 || day.daysAgo >= SEED_DAYS) continue;
    const date = addDays(lastDay, -day.daysAgo);
    const seen = new Set();
    for (const outfit of day.outfits) {
      const pieces = [...new Set(outfit.items.filter((i) => ids.has(i)))].sort();
      if (pieces.length === 0 || seen.has(pieces.join())) continue;
      seen.add(pieces.join());
      rows.push({
        id: uuidFrom(`${personaId}:${date}:${seen.size - 1}`),
        user_id: personaId,
        worn_on: date,
        item_ids: pieces,
        occasion: outfit.occasion ?? null,
      });
    }
  }
  return rows;
}

/**
 * @param {{ personaId: string, items: SeedItem[], feelings: SeedFeeling[],
 *   lifestyleMix: Record<string, number>, plan?: Record<string, Role> | DayPlan | null, lastDay: string }} input
 * @returns {{ rows: OutfitRow[], roles: Map<string, Role> }}
 */
export function seedOutfitLog({ personaId, items, feelings, lifestyleMix, plan = null, lastDay }) {
  if (plan && "days" in plan) return { rows: plannedLog(personaId, items, /** @type {DayPlan} */ (plan), lastDay), roles: new Map() };
  const active = items.filter((i) => (i.status ?? "active") === "active");
  const felt = new Map(feelings.map((f) => [f.item_id, f.structured]));
  const roles = wearRoles(active, felt, /** @type {Record<string, Role> | null} */ (plan));
  const rand = random(`${personaId}:${active.map((i) => i.id).sort().join(",")}`);
  const of = (/** @type {string} */ category) => active.filter((i) => i.category === category && roles.get(i.id) !== "never");

  /** @param {SeedItem} item */
  const weight = (item) => {
    const role = roles.get(item.id);
    if (role === "rare" || role === "never") return 0;
    if (role === "often") return OFTEN_WEIGHT;
    return WEIGHT_BY_LIKED[/** @type {keyof typeof WEIGHT_BY_LIKED} */ (felt.get(item.id)?.liked ?? "unknown")] ?? 1;
  };
  /** @param {SeedItem[]} pool @param {{ low: number, high: number }} temp */
  const pick = (pool, temp) => {
    const fits = pool.filter((i) => {
      const r = i.ai_tags.tempRangeF;
      return !r || (r.min <= temp.high && r.max >= temp.low);
    });
    const choices = (fits.length > 0 ? fits : pool).filter((i) => weight(i) > 0);
    const total = choices.reduce((sum, i) => sum + weight(i), 0);
    let r = rand() * total;
    for (const item of choices) if ((r -= weight(item)) < 0) return item;
    return choices.at(-1);
  };

  // The same sport outfit every time, in other shoes than the day's when it can.
  const sporty = (/** @type {SeedItem} */ i) => (i.ai_tags.occasions ?? []).includes("sport");
  const sportPick = (/** @type {string} */ category) => {
    const pool = of(category).filter((i) => roles.get(i.id) !== "rare");
    return pool.find(sporty) ?? pool.at(-1);
  };
  const sportOutfit = [sportPick("top"), sportPick("bottom"), sportPick("shoes")].filter((i) => i !== undefined);

  /** @type {OutfitRow[]} */
  const rows = [];
  for (let n = SEED_DAYS - 1; n >= 0; n--) {
    const date = addDays(lastDay, -n);
    const index = SEED_DAYS - 1 - n;
    // Fall: highs from the mid 60s down to the high 40s.
    const high = Math.round(66 - index * (18 / SEED_DAYS) + (rand() - 0.5) * 8);
    const temp = { low: high - 14, high };
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    const rareToday = index === RARE_DAY;
    if (rand() < SKIP_CHANCE && !rareToday) continue;

    const rare = rareToday ? active.find((i) => roles.get(i.id) === "rare") : undefined;
    const wearable = (/** @type {string} */ category) => of(category).some((i) => weight(i) > 0);
    const onePiece = rare?.category === "one_piece" || (!rare && wearable("one_piece") && rand() < 0.25);
    /** @type {(SeedItem | undefined)[]} */
    const pieces = onePiece
      ? [rare?.category === "one_piece" ? rare : pick(of("one_piece"), temp)]
      : [rare?.category === "top" ? rare : pick(of("top"), temp), rare?.category === "bottom" ? rare : pick(of("bottom"), temp)];
    pieces.push(rare?.category === "shoes" ? rare : pick(of("shoes"), temp));
    if (high < OUTERWEAR_BELOW_F) pieces.push(rare?.category === "outerwear" ? rare : pick(of("outerwear"), temp));
    if (rare && !pieces.includes(rare)) pieces.push(rare);
    const main = [...new Set(pieces.filter((i) => i !== undefined).map((i) => i.id))].sort();
    if (main.length === 0) continue;

    const occasion = weekend
      ? rand() < 0.5 ? "social" : "home"
      : (lifestyleMix.school ?? 0) > 0 ? "school" : (lifestyleMix.work ?? 0) > 0 ? "work" : null;
    rows.push({ id: uuidFrom(`${personaId}:${date}:0`), user_id: personaId, worn_on: date, item_ids: main, occasion });

    const sport = [...new Set(sportOutfit.map((i) => i.id))].sort();
    if ((lifestyleMix.sport ?? 0) > 0 && !weekend && rand() < SPORT_CHANCE && sport.length > 0 && sport.join() !== main.join()) {
      rows.push({ id: uuidFrom(`${personaId}:${date}:1`), user_id: personaId, worn_on: date, item_ids: sport, occasion: "sport" });
    }
  }
  return { rows, roles };
}
