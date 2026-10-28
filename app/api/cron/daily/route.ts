import { connection } from "next/server";
import { deleteOrphanImages, ORPHAN_MIN_AGE_MS } from "@/lib/cron/orphan-images";
import { createServerClient } from "@/lib/db/server";

// Called once a day by Vercel Cron (vercel.json), which sends
// `Authorization: Bearer $CRON_SECRET`. Touches the database so the free
// Supabase project is not paused for inactivity, and removes orphaned item
// photos older than a day.
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = createServerClient();
  await db.from("users").select("id", { count: "exact", head: true }).throwOnError();
  const deletedImages = await deleteOrphanImages(db, {
    before: new Date(Date.now() - ORPHAN_MIN_AGE_MS),
  });
  return Response.json({ ok: true, deletedImages });
}
