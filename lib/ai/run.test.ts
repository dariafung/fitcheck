import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineAiFunction } from "./define";
import { AiInputError, AiOutputError, AiReplayMissError } from "./errors";
import * as ai from "./index";
import { runAi } from "./run";

const ITEM = {
  id: "852c8e3d-abf7-4955-ab65-9d83194a02ae",
  title: "White button-down",
  tags: {
    category: "top" as const,
    colors: [{ name: "white" }],
    materials: ["cotton"],
    formality: 3,
    occasions: ["work" as const],
  },
};
const OTHER = { ...ITEM, id: "c81b2b56-1f62-4284-83b6-7307a6355ac5", tags: { ...ITEM.tags, category: "bottom" as const } };
const IMAGE = { kind: "url" as const, url: "https://example.com/a.png" };

function fakeDef(live: () => Promise<unknown>) {
  return {
    name: "parseFeeling" as const,
    promptVersion: "test@1",
    input: z.object({ text: z.string() }),
    output: z.object({ ok: z.boolean() }),
    mock: () => ({ ok: true }),
    live,
  };
}

let replayDir: string;
beforeEach(async () => {
  replayDir = await mkdtemp(path.join(tmpdir(), "fitcheck-replay-"));
});
afterEach(async () => {
  await rm(replayDir, { recursive: true, force: true });
});

describe("mock mode", () => {
  it("returns valid, repeatable output for every function", async () => {
    const calls = [
      () => ai.extractItem({ knownFields: { title: "Tee" }, images: [IMAGE], allowWebSearch: false }),
      () => ai.parseFeeling({ text: "Love it", item: ITEM }),
      () => ai.transcribe({ audio: IMAGE }),
      () => ai.judgePairing({ pairs: [{ a: ITEM, b: OTHER }] }),
      () =>
        ai.scorePurchase({
          candidate: ITEM,
          profile: { lifestyleMix: { work: 50, social: 20, sport: 15, home: 15 } },
          anchors: [OTHER],
          questions: [{ id: "fit", text: "Is the fit like the flattering pieces?" }],
        }),
      () =>
        ai.renderOutfit({
          items: [ITEM, OTHER, ITEM].map((i) => ({ id: i.id, image: IMAGE, category: i.tags.category, description: i.title })),
        }),
      () => ai.buildProfile({ items: [ITEM], feelings: [] }),
      () => ai.segmentGarment({ image: IMAGE, category: "shirt" }),
    ];
    for (const call of calls) {
      expect(await call()).toEqual(await call());
    }
  });

  it("rejects invalid input", async () => {
    await expect(ai.parseFeeling({ text: "", item: ITEM })).rejects.toBeInstanceOf(AiInputError);
  });
});

describe("live mode", () => {
  it("retries once when output fails validation", async () => {
    const live = vi.fn().mockResolvedValueOnce({ ok: "nope" }).mockResolvedValueOnce({ ok: true });
    const fn = defineAiFunction(fakeDef(live));
    await expect(fn({ text: "x" }, { mode: "live", record: false })).resolves.toEqual({ ok: true });
    expect(live).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry", async () => {
    const live = vi.fn().mockResolvedValue({ ok: "nope" });
    await expect(runAi(fakeDef(live), { text: "x" }, { mode: "live", record: false })).rejects.toBeInstanceOf(
      AiOutputError,
    );
    expect(live).toHaveBeenCalledTimes(2);
  });
});

describe("replay mode", () => {
  it("replays a recorded live response", async () => {
    const def = fakeDef(async () => ({ ok: false }));
    await runAi(def, { text: "x" }, { mode: "live", record: true, replayDir });
    await expect(runAi(def, { text: "x" }, { mode: "replay", replayDir })).resolves.toEqual({ ok: false });
  });

  it("errors when nothing was recorded", async () => {
    const def = fakeDef(async () => ({ ok: true }));
    await expect(runAi(def, { text: "y" }, { mode: "replay", replayDir })).rejects.toBeInstanceOf(
      AiReplayMissError,
    );
  });
});
