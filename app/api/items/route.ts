import { requireWriter } from "@/lib/auth/guard";
import type { Json } from "@/lib/db/database.types";
import { createServerClient } from "@/lib/db/server";
import { SaveItemRequest } from "@/lib/entry/draft";
import { isOwnImagePath } from "@/lib/entry/images";
import { changedTags } from "@/lib/entry/tags";

// POST a confirmed draft → a new active item in the closet.
export async function POST(request: Request) {
  const writer = await requireWriter();
  if ("denied" in writer) return writer.denied;
  const body = SaveItemRequest.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "invalid_item", issues: body.error.issues }, { status: 400 });
  }
  const item = body.data;
  // The closet holds clothes and shoes only; the add page never offers it.
  if (item.tags.category === "accessory") {
    return Response.json({ error: "accessory" }, { status: 400 });
  }
  const { userId } = writer;
  if (!item.imagePaths.every((path) => isOwnImagePath(path, userId))) {
    return Response.json({ error: "invalid_item" }, { status: 400 });
  }

  const { data, error } = await createServerClient()
    .from("items")
    .insert({
      user_id: userId,
      status: "active",
      entry_method: item.entryMethod,
      title: item.title,
      brand: item.brand || null,
      price_cents: item.priceCents ?? null,
      currency: item.currency ?? null,
      category: item.tags.category,
      image_paths: item.imagePaths,
      ai_tags: item.aiTags as Json,
      user_tags: changedTags(item.aiTags, item.tags) as { [key: string]: Json },
      on_model: item.onModel,
      raw_source: item.rawSource as Json,
    })
    .select("id, title, category")
    .single();
  if (error) throw error;
  return Response.json({ item: data }, { status: 201 });
}
