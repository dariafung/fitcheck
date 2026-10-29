import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as checkPOST } from "@/app/api/checks/route";
import { DELETE as itemDELETE, PATCH as itemPATCH } from "@/app/api/items/[id]/route";
import { POST as feelingPOST } from "@/app/api/items/[id]/feelings/route";
import { POST as voicePOST } from "@/app/api/items/[id]/feelings/voice/route";
import { POST as voiceUploadPOST } from "@/app/api/items/[id]/feelings/voice/upload/route";
import { POST as extractPOST } from "@/app/api/items/extract/route";
import { POST as itemsPOST } from "@/app/api/items/route";
import { POST as pairingsPOST } from "@/app/api/pairings/route";
import { GET as profileGET, PUT as profilePUT } from "@/app/api/profile/route";
import type { ItemTags } from "@/lib/ai";
import { DEMO_READ_ONLY, DEMO_READ_ONLY_ERROR } from "@/lib/auth/messages";
import { DEMO_USER_ID } from "@/lib/db/demo-user";
import { createServerClient } from "@/lib/db/server";
import { fakeScreenshot } from "@/lib/entry/fake-screenshot";
import { jsonRequest, uploadRequest } from "../entry/helpers";
import { pairingKeys, personaSnapshot } from "./persona-snapshot";

// Sign-in on, signed in as the demo account: the real session, current-user
// and guard code, with only the Supabase Auth call faked. Runs every write
// route with a request that would change the persona if it got through.
vi.mock("@/lib/auth/client", () => ({
  createAuthClient: async () => ({
    auth: {
      getClaims: async () => ({ data: { claims: { sub: DEMO_USER_ID, email: "demo@example.com" } } }),
    },
  }),
}));

const db = createServerClient();
let itemId = "";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const tags: ItemTags = {
  category: "shoes",
  colors: [{ name: "black" }],
  materials: ["leather"],
  formality: 3,
  occasions: ["work"],
  tempRangeF: { min: 40, max: 90 },
};

beforeAll(() => {
  vi.stubEnv("AUTH_REQUIRED", "1");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

beforeAll(async () => {
  const { data } = await db
    .from("items")
    .select("id")
    .eq("user_id", DEMO_USER_ID)
    .eq("status", "active")
    .limit(1)
    .maybeSingle()
    .throwOnError();
  if (!data) throw new Error("Demo persona has no items: run `pnpm seed` first.");
  itemId = data.id;
});

const WRITES: [string, () => Promise<Response>][] = [
  [
    "PUT /api/profile",
    () =>
      profilePUT(
        new Request("http://localhost/api/profile", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            heightCm: 190,
            weightKg: 90,
            bustCm: null,
            waistCm: null,
            hipCm: null,
            inseamCm: null,
            bodyShape: "apple",
            lifestyleMix: { work: 9, school: 0, social: 0, sport: 0, home: 0 },
          }),
        }),
      ),
  ],
  [
    "PATCH /api/items/[id]",
    () =>
      itemPATCH(
        new Request(`http://localhost/api/items/${itemId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tempRangeF: { min: 0, max: 1 } }),
        }),
        ctx(itemId),
      ),
  ],
  [
    "DELETE /api/items/[id]",
    () => itemDELETE(new Request(`http://localhost/api/items/${itemId}`, { method: "DELETE" }), ctx(itemId)),
  ],
  [
    "POST /api/items/[id]/feelings",
    () => feelingPOST(jsonRequest(`/api/items/${itemId}/feelings`, { text: "Too tight now." }), ctx(itemId)),
  ],
  [
    "POST /api/items/[id]/feelings/voice/upload",
    () => voiceUploadPOST(jsonRequest(`/api/items/${itemId}/feelings/voice/upload`, {}), ctx(itemId)),
  ],
  [
    "POST /api/items/[id]/feelings/voice",
    () =>
      voicePOST(
        jsonRequest(`/api/items/${itemId}/feelings/voice`, { path: `${DEMO_USER_ID}/${itemId}/note.wav` }),
        ctx(itemId),
      ),
  ],
  [
    "POST /api/items",
    () =>
      itemsPOST(
        jsonRequest("/api/items", {
          entryMethod: "screenshot",
          title: "Sneaked-in loafers",
          imagePaths: [],
          aiTags: tags,
          tags,
          onModel: false,
          rawSource: {},
        }),
      ),
  ],
  [
    "POST /api/items/extract",
    async () => extractPOST(uploadRequest(new Blob([new Uint8Array(await fakeScreenshot())], { type: "image/png" }))),
  ],
];

describe("the demo account is read-only", () => {
  it("turns away every write and leaves the persona exactly as it was", async () => {
    const before = await personaSnapshot(db, DEMO_USER_ID);
    const pairsBefore = await pairingKeys(db, DEMO_USER_ID);

    for (const [name, call] of WRITES) {
      const res = await call();
      expect(res.status, name).toBe(403);
      expect(await res.json(), name).toEqual({ error: DEMO_READ_ONLY_ERROR, message: DEMO_READ_ONLY });
    }

    // Reads and the buy check still work; the check may add pairing cache rows.
    expect((await profileGET()).status).toBe(200);
    expect((await pairingsPOST()).status).toBe(200);
    const check = await checkPOST(jsonRequest("/api/checks", { title: "Black loafers", tags }));
    expect(check.status).toBe(200);

    expect(await personaSnapshot(db, DEMO_USER_ID)).toEqual(before);
    expect(await pairingKeys(db, DEMO_USER_ID)).toEqual(expect.arrayContaining(pairsBefore));
  });
});
