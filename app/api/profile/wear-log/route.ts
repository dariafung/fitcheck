import { z } from "zod";
import { requireWriter } from "@/lib/auth/guard";
import { createServerClient } from "@/lib/db/server";
import { setWearLogEnabled } from "@/lib/wear/settings";

const Body = z.strictObject({ enabled: z.boolean() });

// Turns the outfit calendar on or off. Off keeps the log.
export async function PUT(req: Request) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Send enabled: true or false." }, { status: 400 });
  await setWearLogEnabled(createServerClient(), writer.userId, body.data.enabled);
  return Response.json({ enabled: body.data.enabled });
}
