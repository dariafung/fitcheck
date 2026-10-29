import { describe, expect, it } from "vitest";
import { downsample } from "./resample";

const sine = (hz: number, rate: number, seconds: number) =>
  Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) => Math.sin((2 * Math.PI * hz * i) / rate));

const rms = (x: Float32Array, skip = 100) => {
  let sum = 0;
  for (let i = skip; i < x.length - skip; i++) sum += x[i] * x[i];
  return Math.sqrt(sum / (x.length - 2 * skip));
};

// Zero crossings per second, a rough frequency.
const frequency = (x: Float32Array, rate: number) => {
  let crossings = 0;
  for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 !== x[i] < 0) crossings++;
  return crossings / 2 / (x.length / rate);
};

describe("downsample", () => {
  it("keeps the length in proportion", () => {
    expect(downsample(new Float32Array(48_000), 48_000, 16_000)).toHaveLength(16_000);
    expect(downsample(new Float32Array(44_100), 44_100, 16_000)).toHaveLength(16_000);
  });

  it.each([48_000, 44_100])("keeps a 1 kHz tone from %i Hz", (rate) => {
    const out = downsample(sine(1000, rate, 1), rate, 16_000);
    expect(frequency(out, 16_000)).toBeCloseTo(1000, -1);
    expect(rms(out)).toBeCloseTo(Math.SQRT1_2, 1);
  });

  it.each([48_000, 44_100])("filters out a 12 kHz tone from %i Hz", (rate) => {
    expect(rms(downsample(sine(12_000, rate, 1), rate, 16_000))).toBeLessThan(0.05);
  });

  it("copies when the rate already matches and refuses to upsample", () => {
    const input = Float32Array.from([0.1, 0.2]);
    expect(downsample(input, 16_000, 16_000)).toEqual(input);
    expect(() => downsample(input, 8000, 16_000)).toThrow();
  });

  it("handles 3 minutes of 48 kHz audio quickly", () => {
    const started = performance.now();
    downsample(new Float32Array(48_000 * 180), 48_000, 16_000);
    expect(performance.now() - started).toBeLessThan(2000);
  });
});
