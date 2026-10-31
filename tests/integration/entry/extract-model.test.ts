// What the extract route does with model answers the mock never gives:
// a product it can't identify, and a box it can't use.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/items/extract/route";
import type { ExtractItemOutput } from "@/lib/ai";
import { fakeScreenshot } from "@/lib/entry/fake-screenshot";
import { createTestUser, removeTestUser, uploadRequest } from "./helpers";

const user = vi.hoisted(() => ({ id: "" }));
const answer = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => user.id }));
vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  extractItem: async () => answer.value,
}));

const BASE: ExtractItemOutput = {
  title: "Wrap Midi Dress",
  tags: {
    category: "one_piece",
    colors: [{ name: "rust" }],
    colorFamily: "orange",
    materials: ["crepe"],
    formality: 3,
    tempRangeF: { min: 60, max: 90 },
    occasions: ["social"],
  },
  onModel: true,
  sources: [{ field: "materials", url: "https://example.com/wrap-dress" }],
  lowConfidence: [],
  recognized: true,
  productBox: { x: 0.1, y: 0.12, width: 0.8, height: 0.5 },
};

beforeAll(async () => {
  user.id = await createTestUser();
});
afterAll(() => removeTestUser(user.id));

async function extract() {
  const res = await POST(uploadRequest(new Blob([new Uint8Array(await fakeScreenshot())])));
  return { status: res.status, body: await res.json() };
}

describe("POST /api/items/extract with real-shaped model answers", () => {
  it("says so when the model can't identify a product", async () => {
    answer.value = { ...BASE, recognized: false };
    expect(await extract()).toEqual({ status: 200, body: { error: "unrecognized" } });
  });

  it.each([
    ["outside the screenshot", { x: 0.5, y: 0.1, width: 0.8, height: 0.5 }],
    ["too small", { x: 0.1, y: 0.1, width: 0.02, height: 0.02 }],
    ["missing", undefined],
  ])("uses the whole screenshot when the box is %s, and flags it", async (_, productBox) => {
    answer.value = { ...BASE, productBox };
    const { body } = await extract();
    expect(body.draft.lowConfidence).toContain("image");
    expect(body.draft.rawSource).toMatchObject({ cropped: false });
    expect(body.draft.imagePaths).toHaveLength(1);
  });

  it("passes web sources through to the card", async () => {
    answer.value = BASE;
    const { body } = await extract();
    expect(body.draft.webSources).toEqual(BASE.sources);
    expect(body.draft.lowConfidence).not.toContain("image");
  });

  it("starts the card from the size the model read, and keeps it in the raw source", async () => {
    answer.value = { ...BASE, size: "27 (US 4)" };
    const { body } = await extract();
    expect(body.draft.size).toBe("27 (US 4)");
    expect(body.draft.rawSource).toMatchObject({ aiSize: "27 (US 4)" });

    answer.value = BASE;
    const none = await extract();
    expect(none.body.draft.size).toBeUndefined();
    expect(none.body.draft.rawSource).toMatchObject({ aiSize: null });
  });
});
