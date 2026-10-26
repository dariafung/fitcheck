import { connection } from "next/server";
import { currentMode } from "@/lib/ai";
import { createServerClient } from "@/lib/db/server";

// Reports whether the database answers and which AI mode is active.
export async function GET() {
  // Always run at request time: never prerender or touch the database at build.
  await connection();
  const { error } = await createServerClient()
    .from("users")
    .select("id", { count: "exact", head: true });
  const db = error ? "error" : "ok";
  return Response.json(
    { db, ai: currentMode() },
    { status: error ? 503 : 200 },
  );
}
