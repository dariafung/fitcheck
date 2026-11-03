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
  it("makes an empty profile with the name given, or the default one, never from the email", async () => {
    const id = randomUUID();
    made.push(id);
    await ensureUserRow(db, id, "Sam");
    expect(await row(id)).toMatchObject({
      id,
      display_name: "Sam",
      height_cm: null,
      body_shape: null,
      is_seed: false,
    });
    const unnamed = randomUUID();
    made.push(unnamed);
    await ensureUserRow(db, unnamed, null);
    expect(await row(unnamed)).toMatchObject({ display_name: "fitcheck member" });
  });

  it("leaves an existing row exactly as it is", async () => {
    const id = randomUUID();
    made.push(id);
    await db.from("users").insert({ id, display_name: "Kept", height_cm: 170 }).throwOnError();
    const before = await row(id);
    await ensureUserRow(db, id, "Other");
    await ensureKnownUser(db, id, "Other");
    expect(await row(id)).toEqual(before);
  });

  it("makes the row the first time a user is seen, then stays out of the way", async () => {
    const id = randomUUID();
    made.push(id);
    await ensureKnownUser(db, id, "First");
    expect(await row(id)).toMatchObject({ display_name: "First" });
    await db.from("users").delete().eq("id", id).throwOnError();
    // Already known to this process: no second write.
    await ensureKnownUser(db, id, "First");
    expect(await row(id)).toBeNull();
  });
});

describe("rename_email_named_users (migration 20261102210000)", () => {
  const authUsers: string[] = [];

  afterEach(async () => {
    for (const id of authUsers.splice(0)) await db.auth.admin.deleteUser(id);
  });

  async function account(email: string, displayName: string, isSeed = false) {
    const { data, error } = await db.auth.admin.createUser({ email, password: randomUUID(), email_confirm: true });
    if (error) throw error;
    authUsers.push(data.user.id);
    made.push(data.user.id);
    await db.from("users").insert({ id: data.user.id, display_name: displayName, is_seed: isSeed }).throwOnError();
    return data.user.id;
  }

  it("renames only real accounts still named after their email", async () => {
    const tag = randomUUID().slice(0, 8);
    const emailNamed = await account(`pat.${tag}@example.com`, `pat.${tag}`);
    const picked = await account(`kim.${tag}@example.com`, "Kim");
    const seed = await account(`seed.${tag}@example.com`, `seed.${tag}`, true);
    // A users row with no auth user (no email to compare with).
    const noAuth = randomUUID();
    made.push(noAuth);
    await db.from("users").insert({ id: noAuth, display_name: `pat.${tag}` }).throwOnError();

    const { data: count, error } = await db.rpc("rename_email_named_users");
    if (error) throw error;
    expect(count).toBeGreaterThanOrEqual(1);
    expect((await row(emailNamed))?.display_name).toBe("fitcheck member");
    expect((await row(picked))?.display_name).toBe("Kim");
    expect((await row(seed))?.display_name).toBe(`seed.${tag}`);
    expect((await row(noAuth))?.display_name).toBe(`pat.${tag}`);
  });
});
