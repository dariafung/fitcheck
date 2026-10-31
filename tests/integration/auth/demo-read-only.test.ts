import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as boardPOST } from "@/app/api/checks/board/route";
import { POST as checkCutoutPOST } from "@/app/api/checks/cutout/route";
import { POST as checkPOST } from "@/app/api/checks/route";
import { POST as stylePOST } from "@/app/api/checks/style/route";
import { DELETE as itemDELETE, PATCH as itemPATCH } from "@/app/api/items/[id]/route";
import { POST as feelingPOST } from "@/app/api/items/[id]/feelings/route";
import { POST as voicePOST } from "@/app/api/items/[id]/feelings/voice/route";
import { POST as voiceUploadPOST } from "@/app/api/items/[id]/feelings/voice/upload/route";
import { POST as itemCutoutPOST } from "@/app/api/items/cutout/route";
import { POST as extractPOST } from "@/app/api/items/extract/route";
import { POST as itemsPOST } from "@/app/api/items/route";
import { POST as pairingsPOST } from "@/app/api/pairings/route";
import { GET as profileGET, PUT as profilePUT } from "@/app/api/profile/route";
import { PUT as wearLogPUT } from "@/app/api/profile/wear-log/route";
import { DELETE as outfitDELETE, PATCH as outfitPATCH } from "@/app/api/wear/outfits/[id]/route";
import { POST as insightsPOST } from "@/app/api/wear/insights/route";
import { POST as outfitsPOST } from "@/app/api/wear/outfits/route";
import { POST as styleProfilePOST } from "@/app/api/style-profile/route";
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
let outfitId = "";
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
  const { data: outfit } = await db
    .from("outfit_logs")
    .select("id")
    .eq("user_id", DEMO_USER_ID)
    .limit(1)
    .maybeSingle()
    .throwOnError();
  if (!outfit) throw new Error("Demo persona has no outfits: run `pnpm seed` first.");
  outfitId = outfit.id;
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
            topSize: "XL",
            bottomSize: "XL",
            shoeSize: "M12",
            tempUnit: "C",
            resaleOptIn: false,
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
          body: JSON.stringify({ status: "passing_on" }),
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
  ["POST /api/style-profile", () => styleProfilePOST()],
  [
    "POST /api/items/cutout",
    () =>
      itemCutoutPOST(
        jsonRequest("/api/items/cutout", { path: `${DEMO_USER_ID}/${itemId}.webp`, title: "Loafers", tags }),
      ),
  ],
  [
    "POST /api/items/extract",
    async () => extractPOST(uploadRequest(new Blob([new Uint8Array(await fakeScreenshot())], { type: "image/png" }))),
  ],
  [
    "POST /api/wear/outfits",
    () =>
      outfitsPOST(
        jsonRequest("/api/wear/outfits", {
          id: crypto.randomUUID(),
          date: new Date().toISOString().slice(0, 10),
          itemIds: [itemId],
          occasion: null,
        }),
      ),
  ],
  [
    "PATCH /api/wear/outfits/[id]",
    () =>
      outfitPATCH(
        new Request(`http://localhost/api/wear/outfits/${outfitId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ occasion: "work" }),
        }),
        ctx(outfitId),
      ),
  ],
  [
    "DELETE /api/wear/outfits/[id]",
    () => outfitDELETE(new Request(`http://localhost/api/wear/outfits/${outfitId}`, { method: "DELETE" }), ctx(outfitId)),
  ],
  [
    "PUT /api/profile/wear-log",
    () =>
      wearLogPUT(
        new Request("http://localhost/api/profile/wear-log", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled: false }),
        }),
      ),
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

    // Reads and the buy check still work; the check may add pairing cache rows
    // and the calendar its insights.
    expect((await profileGET()).status).toBe(200);
    expect((await pairingsPOST()).status).toBe(200);
    const check = await checkPOST(jsonRequest("/api/checks", { title: "Black loafers", tags }));
    expect(check.status).toBe(200);
    const photo = `data:image/png;base64,${(await fakeScreenshot()).toString("base64")}`;
    const cutout = await checkCutoutPOST(jsonRequest("/api/checks/cutout", { photo, title: "Black loafers", tags }));
    expect(cutout.status).toBe(200);
    const board = await boardPOST(jsonRequest("/api/checks/board", { candidate: { photo, onModel: false }, itemIds: [itemId] }));
    expect(board.status).toBe(200);
    // Style it with AI stores nothing either; it spends the shared budget.
    const style = await stylePOST(jsonRequest("/api/checks/style", { candidate: { photo, title: "Black loafers", tags }, itemIds: [itemId] }));
    expect(style.status).toBe(200);
    // Insights are a cache like pairings: the demo may fill it, never the log.
    expect((await insightsPOST()).status).toBe(200);

    expect(await personaSnapshot(db, DEMO_USER_ID)).toEqual(before);
    expect(await pairingKeys(db, DEMO_USER_ID)).toEqual(expect.arrayContaining(pairsBefore));
  });
});
