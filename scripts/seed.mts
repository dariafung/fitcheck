// Loads the fictional demo persona, items, feelings, style card and 10 days
// of outfits (ending yesterday, or on SEED_LAST_DAY) into the database, plus
// the seed neighbors: other seed users with just a name and sizes, and a few
// pieces of their own they pass on. They are the persona's buyers and the
// sellers in its "Suits you". The resale matches both ways are seeded as
// cached checks (resale-matches.json), so the demo never checks anyone. The
// persona's old items, card, outfits, insights and photos are cleared first,
// so the persona ends up exactly as seeded. Item photos listed in items.json
// and neighbors.json image_paths are uploaded from seed/images/.
//
// Local by default (.env.local) and refuses any other URL. SEED_REMOTE=1
// seeds the hosted project instead: SUPABASE_URL and SUPABASE_SECRET_KEY come
// from the environment, and the project ref must be typed back to confirm.
//
// Also creates the read-only demo account's auth user (same id as the
// persona) with DEMO_ACCOUNT_PASSWORD: from .env.local locally, from the
// environment for SEED_REMOTE. The password never lives in the repo.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";
import { DEMO_EMAIL, ensureDemoAuthUser } from "./lib/demo-auth.mjs";
import { addDays, futureSeedWarning, SEED_DAYS, seedLastDay, seedOutfitLog, type DayPlan, type SeedFeeling, type SeedItem } from "./lib/wear-seed.mjs";
import "./lib/app-imports.mjs";

// The app's own modules, for the seeded matches' fingerprints.
const { currentMode } = (await import(new URL("../lib/ai/mode.ts", import.meta.url).href)) as typeof import("../lib/ai/mode");
const { itemTags } = (await import(new URL("../lib/closet/tags.ts", import.meta.url).href)) as typeof import("../lib/closet/tags");
const { buyerStates, fingerprint } = (await import(new URL("../lib/resale/fingerprint.ts", import.meta.url).href)) as typeof import("../lib/resale/fingerprint");

interface SeedMatch {
  item_id: string;
  seller_id: string;
  buyer_id: string;
  score: number;
  highlights: string[];
  buyer_reasons: string[];
}

const ITEM_IMAGES_BUCKET = "item-images";
const IMAGE_TYPES: Record<string, string> = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg" };

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(new URL(`../seed/${file}`, import.meta.url), "utf8"));
}

const remote = process.env.SEED_REMOTE === "1";
if (!remote) process.loadEnvFile(".env.local");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  throw new Error(remote ? "Set SUPABASE_URL and SUPABASE_SECRET_KEY." : "Run `pnpm env:local` first.");
}
const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD;
if (!demoPassword) {
  throw new Error(remote ? `Set DEMO_ACCOUNT_PASSWORD for ${DEMO_EMAIL}.` : "Run `pnpm env:local` first.");
}
// Seeded matches only count as up to date for the AI mode the site runs in
// (the hosted site: live), so the hosted seed must say which.
if (remote && !process.env.AI_MODE) throw new Error("Set AI_MODE to the hosted site's (live).");
if (remote) {
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(url)?.[1];
  if (!ref) throw new Error(`Not a hosted Supabase URL: ${url}`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const typed = await rl.question(`Seeding project ${ref}: old demo data is deleted first. Type the ref to go on: `);
  rl.close();
  if (typed.trim() !== ref) throw new Error("Ref did not match; nothing was changed.");
} else if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  throw new Error(`Refusing to seed a non-local database: ${url} (SEED_REMOTE=1 seeds the hosted project)`);
}

const persona = readJson("persona.json") as { id: string; lifestyle_mix: Record<string, number> };
// The outfit log ends yesterday (Chicago), leaving today for the demo, or on
// SEED_LAST_DAY when set. Items count as owned since before it starts.
const lastDay = seedLastDay(process.env.SEED_LAST_DAY);
const future = futureSeedWarning(lastDay);
if (future) console.warn(future);
const ownedSince = `${addDays(lastDay, -SEED_DAYS)}T12:00:00Z`;
const items = (readJson("items.json") as (SeedItem & { image_paths?: string[] })[]).map(
  (item) => ({ ...item, user_id: persona.id, created_at: ownedSince }),
);
const feelings = (readJson("feelings.json") as SeedFeeling[]).map(
  (feeling) => ({ ...feeling, user_id: persona.id }),
);
const neighbors = readJson("neighbors.json") as { users: { id: string }[]; items: { image_paths?: string[] }[] };
const imagePaths = [...items, ...neighbors.items].flatMap((item) => item.image_paths ?? []);

const db = createClient(url, key, { auth: { persistSession: false } });
const bucket = db.storage.from(ITEM_IMAGES_BUCKET);

// The seed is the whole persona: pieces from an older seed, or added by
// hand or by tests, go first. Items take their feelings and pairings with them.
for (const table of ["items", "style_profiles", "outfit_logs", "wear_insights"] as const) {
  const cleared = await db.from(table).delete().eq("user_id", persona.id);
  if (cleared.error) throw cleared.error;
}
const { data: old, error } = await bucket.list(persona.id, { limit: 1000 });
if (error) throw error;
if (old.length > 0) {
  const removed = await bucket.remove(old.map((f) => `${persona.id}/${f.name}`));
  if (removed.error) throw removed.error;
}

// A calendar turned off while testing comes back on.
const users = await db.from("users").upsert({ ...persona, wear_log_enabled: true });
if (users.error) throw users.error;
await ensureDemoAuthUser(db, persona.id, demoPassword);
for (const imagePath of imagePaths) {
  const file = readFileSync(new URL(`../seed/images/${path.basename(imagePath)}`, import.meta.url));
  const contentType = IMAGE_TYPES[path.extname(imagePath)];
  if (!contentType) throw new Error(`Unsupported seed image type: ${imagePath}`);
  const uploaded = await bucket.upload(imagePath, file, { contentType, upsert: true });
  if (uploaded.error) throw uploaded.error;
}
const upserted = await db.from("items").upsert(items);
if (upserted.error) throw upserted.error;
const felt = await db.from("item_feelings").upsert(feelings);
if (felt.error) throw felt.error;
// The persona's style card; a placeholder until a real one is recorded.
const card = readJson("style-profile.json") as {
  promptVersion: string;
  inputHash: string;
  headline: unknown;
  suits: unknown;
  avoid: unknown;
};
const styled = await db.from("style_profiles").upsert(
  {
    user_id: persona.id,
    headline: card.headline,
    suits: card.suits,
    avoid: card.avoid,
    input_hash: card.inputHash,
    prompt_version: card.promptVersion,
    generated_at: new Date().toISOString(),
    generating_token: null,
  },
  { onConflict: "user_id" },
);
if (styled.error) throw styled.error;

// Dates move with the day the seed runs; the old log and its insights went
// with the rest of the persona above.
const plan = existsSync(new URL("../seed/wear-plan.json", import.meta.url))
  ? (readJson("wear-plan.json") as Record<string, "rare" | "often" | "never"> | DayPlan)
  : null;
const { rows: outfits } = seedOutfitLog({
  personaId: persona.id,
  items,
  feelings,
  lifestyleMix: persona.lifestyle_mix,
  plan,
  lastDay,
});
const logged = await db.from("outfit_logs").insert(outfits);
if (logged.error) throw logged.error;

// Seed neighbors: opted-in seed users with only a name and sizes, which is
// all matching needs, and the pieces they pass on. Their old clothes go first,
// taking feelings, pairings and matches with them; anything an older seed
// stored about them (measurements, body shape, outfits wanted) is cleared.
const neighborIds = neighbors.users.map((u) => u.id);
const oldNeighborItems = await db.from("items").delete().in("user_id", neighborIds);
if (oldNeighborItems.error) throw oldNeighborItems.error;
for (const table of ["style_profiles", "outfit_logs", "wear_insights"] as const) {
  const cleared = await db.from(table).delete().in("user_id", neighborIds);
  if (cleared.error) throw cleared.error;
}
const NO_PROFILE = {
  height_cm: null,
  weight_kg: null,
  bust_cm: null,
  waist_cm: null,
  hip_cm: null,
  inseam_cm: null,
  body_shape: null,
  lifestyle_mix: {},
  temp_unit: null,
};
const neighborUsers = await db.from("users").upsert(neighbors.users.map((u) => ({ ...NO_PROFILE, ...u })));
if (neighborUsers.error) throw neighborUsers.error;
const neighborItems = await db.from("items").insert(neighbors.items);
if (neighborItems.error) throw neighborItems.error;

// The cached buy checks both ways, under the fingerprint the app works out
// for each now: the neighbors' checks for the persona's passing-on pieces
// (the count the persona sees) and the persona's for theirs ("Suits you").
// Fresh, so opening either side never runs a check.
const seededMatches = (readJson("resale-matches.json") as { matches: SeedMatch[] }).matches;
const [{ data: soldItems, error: soldError }, states] = await Promise.all([
  db
    .from("items")
    .select("id, user_id, title, category, ai_tags, user_tags, image_paths")
    .in(
      "id",
      seededMatches.map((m) => m.item_id),
    ),
  buyerStates(db as unknown as Parameters<typeof buyerStates>[0], [...new Set(seededMatches.map((m) => m.buyer_id))]),
]);
if (soldError) throw soldError;
const matchRows = seededMatches.map((m) => {
  const item = soldItems.find((i) => i.id === m.item_id);
  const state = states.get(m.buyer_id);
  if (!item || !state || item.user_id !== m.seller_id) {
    throw new Error(`Seed match ${m.item_id} × ${m.buyer_id}: item, seller or buyer doesn't match.`);
  }
  const sold = { title: item.title, tags: itemTags(item), photoPath: item.image_paths[0] ?? null };
  return { ...m, fingerprint: fingerprint(sold, state, currentMode()) };
});
const matched = await db.from("resale_matches").upsert(matchRows, { onConflict: "item_id,buyer_id" });
if (matched.error) throw matched.error;

console.log(
  `Seeded 1 persona, ${items.length} items, ${feelings.length} feelings, 1 style card, ` +
    `${outfits.length} outfits to ${lastDay}, ${imagePaths.length} images, ${neighborIds.length} seed neighbors ` +
    `with ${neighbors.items.length} pieces and ${matchRows.length} cached matches` +
    (remote ? " into the hosted project." : "."),
);
