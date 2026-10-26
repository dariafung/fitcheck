// Writes .env.local (mode 600) for the local Supabase stack. Prints no secrets.
import { chmodSync, writeFileSync } from "node:fs";
import { readLocalSupabase } from "./lib/local-supabase.mjs";

const env = readLocalSupabase();
const lines = [
  `SUPABASE_URL=${env.SUPABASE_URL}`,
  `SUPABASE_SECRET_KEY=${env.SUPABASE_SECRET_KEY}`,
  "AI_MODE=mock",
];
writeFileSync(".env.local", `${lines.join("\n")}\n`, { mode: 0o600 });
chmodSync(".env.local", 0o600);
console.log("Wrote .env.local for", env.SUPABASE_URL);
