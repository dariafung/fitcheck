import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Reads the URL and secret key of the local Supabase stack from `supabase status`.
 * Throws with a hint when the stack is not running.
 * @returns {{ SUPABASE_URL: string, SUPABASE_SECRET_KEY: string }}
 */
export function readLocalSupabase() {
  const bin = path.join(process.cwd(), "node_modules", ".bin", "supabase");
  let status;
  try {
    const out = execFileSync(bin, ["status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    status = JSON.parse(out);
  } catch {
    throw new Error(
      "Local Supabase is not running. Start it with `pnpm db:start`.",
    );
  }
  if (!status.API_URL || !status.SECRET_KEY) {
    throw new Error("`supabase status` did not report API_URL and SECRET_KEY.");
  }
  return { SUPABASE_URL: status.API_URL, SUPABASE_SECRET_KEY: status.SECRET_KEY };
}
