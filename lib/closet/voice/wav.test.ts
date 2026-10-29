import { describe, expect, it } from "vitest";
import { encodeWav, readWavInfo, voiceWavProblem } from "./wav";

const seconds = (s: number, rate = 16_000) => new Float32Array(Math.round(s * rate));

describe("encodeWav", () => {
  it("writes a 44-byte PCM header for 16 kHz mono 16-bit", () => {
    const wav = encodeWav(seconds(1));
    const view = new DataView(wav.buffer);
    const text = (o: number) => String.fromCharCode(...wav.subarray(o, o + 4));
    expect(wav.length).toBe(44 + 32_000);
    expect(text(0)).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(wav.length - 8);
    expect(text(8)).toBe("WAVE");
    expect(text(12)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint32(28, true)).toBe(32_000);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(36)).toBe("data");
    expect(view.getUint32(40, true)).toBe(32_000);
  });

  it("clips samples to 16-bit range", () => {
    const view = new DataView(encodeWav(Float32Array.from([1, -1, 2, -2, 0, 0.5])).buffer);
    expect([0, 1, 2, 3, 4, 5].map((i) => view.getInt16(44 + i * 2, true))).toEqual([
      32767, -32768, 32767, -32768, 0, 16383,
    ]);
  });
});

describe("readWavInfo", () => {
  it("reads back what encodeWav wrote", () => {
    expect(readWavInfo(encodeWav(seconds(2.5)))).toEqual({
      format: 1,
      channels: 1,
      sampleRate: 16_000,
      bitsPerSample: 16,
      dataBytes: 80_000,
      durationMs: 2500,
    });
  });

  it("skips chunks before data", () => {
    const wav = encodeWav(seconds(1));
    const extra = new Uint8Array([..."LIST"].map((c) => c.charCodeAt(0)).concat([4, 0, 0, 0, 1, 2, 3, 4]));
    const withList = new Uint8Array([...wav.subarray(0, 36), ...extra, ...wav.subarray(36)]);
    expect(readWavInfo(withList)?.durationMs).toBe(1000);
  });

  it("returns null for anything else", () => {
    expect(readWavInfo(new Uint8Array(0))).toBeNull();
    expect(readWavInfo(new TextEncoder().encode("not a wav file at all"))).toBeNull();
    expect(readWavInfo(encodeWav(seconds(1)).subarray(0, 30))).toBeNull();
  });
});

describe("voiceWavProblem", () => {
  it("accepts a recording up to 3 minutes", () => {
    expect(voiceWavProblem(encodeWav(seconds(0.6)))).toBeNull();
    expect(voiceWavProblem(encodeWav(seconds(180)))).toBeNull();
  });

  it("refuses longer, empty, other formats and non-WAV", () => {
    expect(voiceWavProblem(encodeWav(seconds(182)))).toBe("longer than 3 minutes");
    expect(voiceWavProblem(encodeWav(new Float32Array(0)))).toBe("empty");
    expect(voiceWavProblem(encodeWav(seconds(1, 48_000), 48_000))).toBe("not 16 kHz mono 16-bit PCM");
    expect(voiceWavProblem(new TextEncoder().encode("hello"))).toBe("not a WAV file");
  });
});
