import { randomUUID } from "node:crypto";
import { ITEM_IMAGES_BUCKET } from "@/lib/entry/images";
import { createServerClient } from "@/lib/db/server";

// A throwaway user per test file; the local database is shared by every lane.
export async function createTestUser(): Promise<string> {
  const id = randomUUID();
  await createServerClient()
    .from("users")
    .insert({ id, display_name: "Entry test user" })
    .throwOnError();
  return id;
}

// Deletes the user (items cascade) and every image stored under their id.
export async function removeTestUser(id: string): Promise<void> {
  const db = createServerClient();
  const bucket = db.storage.from(ITEM_IMAGES_BUCKET);
  const { data } = await bucket.list(id, { limit: 1000 });
  if (data?.length) await bucket.remove(data.map((f) => `${id}/${f.name}`));
  await db.from("users").delete().eq("id", id).throwOnError();
}

export function uploadRequest(file?: Blob): Request {
  const body = new FormData();
  if (file) body.append("screenshot", file, "shot.png");
  return new Request("http://localhost/api/items/extract", { method: "POST", body });
}

export function jsonRequest(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
