import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { ensureKnownUser, ensureUserRow } from "@/lib/auth/users";
import { createServerClient } from "@/lib/db/server";

const db = createServerClient();
const made: string[] = [];

afterEach(async () => {
  await db.from("users").delete().in("id", made.splice(0)).throwOnError();
});

async function row(id: string) {
  const { data } = await db.from("users").select("*").eq("id", id).maybeSingle().throwOnError();
  return data;
}

describe("ensureUserRow", () => {
  it("makes an empty profile named after the email", async () => {
    const id = randomUUID();
    made.push(id);
    await ensureUserRow(db, id, "sam@example.com");
    expect(await row(id)).toMatchObject({
      id,
      display_name: "sam",
      height_cm: null,
      body_shape: null,
      is_seed: false,
    });
  });

  it("leaves an existing row exactly as it is", async () => {
    const id = randomUUID();
    made.push(id);
    await db.from("users").insert({ id, display_name: "Kept", height_cm: 170 }).throwOnError();
    const before = await row(id);
    await ensureUserRow(db, id, "other@example.com");
    await ensureKnownUser(db, id, "other@example.com");
    expect(await row(id)).toEqual(before);
  });

  it("makes the row the first time a user is seen, then stays out of the way", async () => {
    const id = randomUUID();
    made.push(id);
    await ensureKnownUser(db, id, "first@example.com");
    expect(await row(id)).toMatchObject({ display_name: "first" });
    await db.from("users").delete().eq("id", id).throwOnError();
    // Already known to this process: no second write.
    await ensureKnownUser(db, id, "first@example.com");
    expect(await row(id)).toBeNull();
  });
});
