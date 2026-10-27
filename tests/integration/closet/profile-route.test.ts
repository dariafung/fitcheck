import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/profile/route";
import { createServerClient } from "@/lib/db/server";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => user.id }));

const db = createServerClient();

const INPUT = {
  heightCm: 170.04,
  weightKg: 61.2,
  bustCm: null,
  waistCm: 72,
  hipCm: null,
  inseamCm: null,
  bodyShape: "hourglass",
  lifestyleMix: { work: 5, school: 0, social: 3, sport: 2, home: 4 },
};

// A brand-new user: nothing filled in yet.
beforeEach(async () => {
  user.id = randomUUID();
  await db.from("users").insert({ id: user.id, display_name: "Profile test user" }).throwOnError();
});

afterEach(async () => {
  await db.from("users").delete().eq("id", user.id).throwOnError();
});

function put(body: unknown) {
  return PUT(
    new Request("http://test/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("GET /api/profile", () => {
  it("returns an empty profile for a new user", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).profile).toEqual({
      heightCm: null,
      weightKg: null,
      bustCm: null,
      waistCm: null,
      hipCm: null,
      inseamCm: null,
      bodyShape: null,
      lifestyleMix: { work: 0, school: 0, social: 0, sport: 0, home: 0 },
    });
  });

  it("reads an old-format mix or unknown body shape as not filled in", async () => {
    await db
      .from("users")
      .update({ body_shape: "triangle", lifestyle_mix: { work: 50, social: 20, sport: 15, home: 15 } })
      .eq("id", user.id)
      .throwOnError();
    const { profile } = await (await GET()).json();
    expect(profile.bodyShape).toBeNull();
    expect(profile.lifestyleMix).toEqual({ work: 0, school: 0, social: 0, sport: 0, home: 0 });
  });

  it("is 404 when the user is gone", async () => {
    user.id = randomUUID();
    expect((await GET()).status).toBe(404);
  });
});

describe("PUT /api/profile", () => {
  it("saves the profile in cm / kg and reads it back", async () => {
    const res = await put(INPUT);
    expect(res.status).toBe(200);
    const saved = { ...INPUT, heightCm: 170 };
    expect((await res.json()).profile).toEqual(saved);
    expect((await (await GET()).json()).profile).toEqual(saved);

    const { data } = await db
      .from("users")
      .select("height_cm, body_shape, lifestyle_mix")
      .eq("id", user.id)
      .single()
      .throwOnError();
    expect(data).toEqual({ height_cm: 170, body_shape: "hourglass", lifestyle_mix: INPUT.lifestyleMix });
  });

  it("clears optional measurements that are sent as null", async () => {
    await put({ ...INPUT, bustCm: 88 });
    const { profile } = await (await put(INPUT)).json();
    expect(profile.bustCm).toBeNull();
  });

  it("rejects a profile without height, weight or body shape, and changes nothing", async () => {
    for (const bad of [
      { ...INPUT, heightCm: null },
      { ...INPUT, weightKg: undefined },
      { ...INPUT, bodyShape: null },
      { ...INPUT, lifestyleMix: { ...INPUT.lifestyleMix, work: 31 } },
      "not json",
    ]) {
      expect((await put(bad)).status).toBe(400);
    }
    expect((await (await GET()).json()).profile.heightCm).toBeNull();
  });

  it("is 404 when the user is gone", async () => {
    user.id = randomUUID();
    expect((await put(INPUT)).status).toBe(404);
  });
});
