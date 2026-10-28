import { createClient } from "@supabase/supabase-js";
import { DEMO_USER_ID } from "../../../lib/db/current-user";
import { ensureDemoAuthUser } from "../../../scripts/lib/demo-auth.mjs";
import { readLocalSupabase } from "../../../scripts/lib/local-supabase.mjs";

// The demo persona comes from `pnpm seed`; its sign-in gets the password the
// server was started with.
export default async function globalSetup() {
  const env = readLocalSupabase();
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  });
  const persona = await db.from("users").select("id").eq("id", DEMO_USER_ID).maybeSingle();
  if (!persona.data) throw new Error("Demo persona missing: run `pnpm seed` first.");
  await ensureDemoAuthUser(db, DEMO_USER_ID, process.env.DEMO_ACCOUNT_PASSWORD!);
}
