import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "../env";
import type { Database } from "./database.types";

export type Db = SupabaseClient<Database>;

let client: Db | undefined;

// Uses the secret key, which bypasses RLS. Import only from server code.
export function createServerClient(): Db {
  if (client) return client;
  const env = serverEnv();
  client = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
