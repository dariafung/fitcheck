import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as transcribePost } from "@/app/api/items/[id]/feelings/voice/route";
import { POST as uploadPost } from "@/app/api/items/[id]/feelings/voice/upload/route";
import { AiUpstreamError } from "@/lib/ai/errors";
import { FEELING_AUDIO_BUCKET } from "@/lib/closet/voice/path";
import { encodeWav, VOICE_SAMPLE_RATE } from "@/lib/closet/voice/wav";
import { createTestCloset } from "./helpers";

const user = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/db/current-user", () => ({ currentUserId: () => user.id }));

// The mock transcribe, or a failure when `fail` is set.
const ai = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai")>();
  return {
    ...original,
    transcribe: (...args: Parameters<typeof original.transcribe>) => {
      if (ai.fail) throw new AiUpstreamError("transcribe", 500);
      return original.transcribe(...args);
    },
  };
});

const SPEECH = readFileSync(path.join(process.cwd(), "fixtures", "audio", "feeling-en.wav"));
const MOCK_TEXT = "Mock transcript: this fits well and I wear it a lot.";

let closet: Awaited<ReturnType<typeof createTestCloset>>;

beforeEach(async () => {
  closet = await createTestCloset();
  user.id = closet.userId;
  ai.fail = false;
});

afterEach(async () => {
  const stored = await files();
  if (stored.length > 0) {
    await closet.db.storage.from(FEELING_AUDIO_BUCKET).remove(stored.map((f) => `${folder()}/${f}`));
  }
  await closet.cleanup();
});

const folder = () => `${closet.userId}/${closet.itemId}`;

async function files(): Promise<string[]> {
  const { data, error } = await closet.db.storage.from(FEELING_AUDIO_BUCKET).list(folder());
  if (error) throw error;
  return data.map((f) => f.name);
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function uploadUrl(id = closet.itemId) {
  return uploadPost(new Request(`http://test/api/items/${id}/feelings/voice/upload`, { method: "POST" }), params(id));
}

// Uploads the bytes the way the browser does and returns the path.
async function upload(bytes: Uint8Array): Promise<string> {
  const res = await uploadUrl();
  const { path, uploadUrl: url } = (await res.json()) as { path: string; uploadUrl: string };
  const put = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "audio/wav" },
    body: new Blob([Uint8Array.from(bytes)], { type: "audio/wav" }),
  });
  expect(put.ok).toBe(true);
  return path;
}

function transcribe(body: unknown, id = closet.itemId) {
  return transcribePost(
    new Request(`http://test/api/items/${id}/feelings/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    params(id),
  );
}

describe("POST /api/items/[id]/feelings/voice/upload", () => {
  it("signs an upload under this user and item", async () => {
    const res = await uploadUrl();
    expect(res.status).toBe(200);
    const { path } = (await res.json()) as { path: string };
    expect(path).toMatch(new RegExp(`^${folder()}/[0-9a-f-]{36}\\.wav$`));

    await upload(SPEECH);
    expect(await files()).toHaveLength(1);
  });

  it("refuses an item that is not this user's", async () => {
    expect((await uploadUrl(randomUUID())).status).toBe(404);
  });
});

describe("POST /api/items/[id]/feelings/voice", () => {
  it("returns the transcript, saves nothing and deletes the recording", async () => {
    const path = await upload(SPEECH);
    const res = await transcribe({ path });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: MOCK_TEXT });
    expect(await files()).toEqual([]);

    const { data } = await closet.db.from("item_feelings").select("id").eq("item_id", closet.itemId);
    expect(data).toEqual([]);
  });

  it("deletes the recording when transcription fails", async () => {
    const path = await upload(SPEECH);
    ai.fail = true;
    const res = await transcribe({ path });
    expect(res.status).toBe(502);
    expect(await files()).toEqual([]);
  });

  it("refuses audio that is not a short 16 kHz WAV, and deletes it", async () => {
    const tooLong = encodeWav(new Float32Array(182 * VOICE_SAMPLE_RATE));
    for (const bytes of [new TextEncoder().encode("not audio"), encodeWav(new Float32Array(48_000), 48_000), tooLong]) {
      const path = await upload(bytes);
      expect((await transcribe({ path })).status).toBe(400);
      expect(await files()).toEqual([]);
    }
  });

  it("only takes this user's paths for this item", async () => {
    const name = `${randomUUID()}.wav`;
    expect((await transcribe({ path: `${randomUUID()}/${closet.itemId}/${name}` })).status).toBe(400);
    expect((await transcribe({ path: `${closet.userId}/${randomUUID()}/${name}` })).status).toBe(400);
    expect((await transcribe({ path: `${folder()}/../x/${name}` })).status).toBe(400);
    expect((await transcribe({})).status).toBe(400);
    expect((await transcribe({ path: `${folder()}/${name}` }, randomUUID())).status).toBe(404);
  });

  it("answers 404 when nothing was uploaded", async () => {
    expect((await transcribe({ path: `${folder()}/${randomUUID()}.wav` })).status).toBe(404);
  });
});
