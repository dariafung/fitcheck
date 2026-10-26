import type { TestProject } from "vitest/node";
import { readLocalSupabase } from "../../scripts/lib/local-supabase.mjs";

declare module "vitest" {
  export interface ProvidedContext {
    supabaseEnv: { SUPABASE_URL: string; SUPABASE_SECRET_KEY: string };
  }
}

// Fails fast when local Supabase is down; hands its URL and key to the workers.
export default function setup(project: TestProject) {
  project.provide("supabaseEnv", readLocalSupabase());
}
