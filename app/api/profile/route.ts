import { connection } from "next/server";
import { requireWriter } from "@/lib/auth/guard";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { loadProfile, ProfileInput, saveProfile } from "@/lib/profile/profile";

export async function GET() {
  await connection();
  const profile = await loadProfile(createServerClient(), await currentUserId());
  if (!profile) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ profile });
}

// Saves body measurements (cm / kg), body shape and the lifestyle mix
// together. Returns the saved profile.
export async function PUT(req: Request) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const body = ProfileInput.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Some fields are missing or look off." }, { status: 400 });
  }
  const profile = await saveProfile(createServerClient(), writer.userId, body.data);
  if (!profile) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ profile });
}
