// Loads the fictional demo persona and items into the local database.
// Idempotent: rows have fixed ids and are upserted. Refuses non-local URLs.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(new URL(`../seed/${file}`, import.meta.url), "utf8"));
}

process.loadEnvFile(".env.local");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Run `pnpm env:local` first.");
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  throw new Error(`Refusing to seed a non-local database: ${url}`);
}

const persona = readJson("persona.json") as { id: string };
const items = (readJson("items.json") as Record<string, unknown>[]).map(
  (item) => ({ ...item, user_id: persona.id }),
);

const db = createClient(url, key, { auth: { persistSession: false } });

const users = await db.from("users").upsert(persona);
if (users.error) throw users.error;
const upserted = await db.from("items").upsert(items);
if (upserted.error) throw upserted.error;

console.log(`Seeded 1 persona and ${items.length} items.`);
