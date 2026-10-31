// Writes a local account's closet out as the demo persona's seed: the items
// and their photos, the feelings and the style card become seed/items.json,
// seed/feelings.json, seed/style-profile.json and seed/images/. A way to
// build the persona from the real app: sign up locally, add the pieces from
// screenshots, write how they feel, open home once for the card, then run
//   node scripts/export-persona.mts <email>
// Ids are kept, so delete that account before `pnpm seed`. seed/persona.json
// and seed/wear-plan.json are written by hand and left alone.
//
// Local only (.env.local); refuses any other URL.
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ITEM_IMAGES_BUCKET = "item-images";
const SEED = new URL("../seed/", import.meta.url);

const email = process.argv[2];
if (!email) throw new Error("Usage: node scripts/export-persona.mts <email of the local account>");
process.loadEnvFile(".env.local");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Run `pnpm env:local` first.");
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  throw new Error(`Refusing to read a non-local database: ${url}`);
}

const persona = JSON.parse(readFileSync(new URL("persona.json", SEED), "utf8")) as { id: string };
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: users, error: usersError } = await db.auth.admin.listUsers({ perPage: 1000 });
if (usersError) throw usersError;
const userId = users.users.find((u) => u.email === email)?.id;
if (!userId) throw new Error(`No local account for ${email}`);
if (userId === persona.id) throw new Error("That is the persona itself; export another account.");

const { data: items } = await db
  .from("items")
  .select("id, image_paths, status, entry_method, title, brand, size, price_cents, currency, category, ai_tags, user_tags, on_model, raw_source")
  .eq("user_id", userId)
  .order("created_at")
  .throwOnError();
const { data: feelings } = await db
  .from("item_feelings")
  .select("id, item_id, raw_text, source, structured, parsed_at")
  .eq("user_id", userId)
  .order("created_at")
  .throwOnError();
const { data: card } = await db
  .from("style_profiles")
  .select("prompt_version, input_hash, headline, suits, avoid")
  .eq("user_id", userId)
  .maybeSingle()
  .throwOnError();

if (items.length === 0) throw new Error(`${email} has no items.`);
const unparsed = feelings.filter((f) => !f.structured || !f.parsed_at);
if (unparsed.length > 0) throw new Error(`${unparsed.length} feelings aren't parsed yet; save them again and rerun.`);
if (!card?.input_hash) throw new Error("No style card yet: open home once and rerun.");

// One photo per item, named after the item, in the persona's folder.
const bucket = db.storage.from(ITEM_IMAGES_BUCKET);
for (const old of readdirSync(new URL("images/", SEED))) rmSync(new URL(`images/${old}`, SEED));
const seedItems = [];
for (const item of items) {
  const [photo] = item.image_paths;
  if (!photo) throw new Error(`"${item.title}" has no photo.`);
  const { data, error } = await bucket.download(photo);
  if (error) throw error;
  const file = `${item.id}${path.extname(photo)}`;
  writeFileSync(new URL(`images/${file}`, SEED), Buffer.from(await data.arrayBuffer()));
  seedItems.push({ ...item, image_paths: [`${persona.id}/${file}`] });
}

const write = (file: string, value: unknown) =>
  writeFileSync(new URL(file, SEED), `${JSON.stringify(value, null, 2)}\n`);
write("items.json", seedItems);
// Postgres says +00:00; the seed uses Z.
write("feelings.json", feelings.map((f) => ({ ...f, parsed_at: new Date(f.parsed_at!).toISOString() })));
write("style-profile.json", {
  promptVersion: card.prompt_version,
  inputHash: card.input_hash,
  headline: card.headline,
  suits: card.suits,
  avoid: card.avoid,
});

console.log(
  `Exported ${seedItems.length} items, ${feelings.length} feelings, 1 style card and ` +
    `${seedItems.length} photos from ${email}.`,
);
