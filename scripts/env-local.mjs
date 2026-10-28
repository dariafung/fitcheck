// Writes .env.local (mode 600) for the local Supabase stack. Prints no secrets.
// The local demo account password is random and kept across reruns, so a
// seeded demo user keeps working.
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { readLocalSupabase } from "./lib/local-supabase.mjs";

const env = readLocalSupabase();
const previous = existsSync(".env.local") ? parseEnv(readFileSync(".env.local", "utf8")) : {};
const demoPassword = previous.DEMO_ACCOUNT_PASSWORD || randomBytes(18).toString("base64url");
const lines = [
  `SUPABASE_URL=${env.SUPABASE_URL}`,
  `SUPABASE_SECRET_KEY=${env.SUPABASE_SECRET_KEY}`,
  `SUPABASE_PUBLISHABLE_KEY=${env.SUPABASE_PUBLISHABLE_KEY}`,
  `DEMO_ACCOUNT_PASSWORD=${demoPassword}`,
  "AI_MODE=mock",
];
writeFileSync(".env.local", `${lines.join("\n")}\n`, { mode: 0o600 });
chmodSync(".env.local", 0o600);
console.log("Wrote .env.local for", env.SUPABASE_URL);
