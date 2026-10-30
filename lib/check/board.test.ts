import sharp, { type OverlayOptions } from "sharp";
import { describe, expect, it } from "vitest";
import { cutOut } from "./board";

const WHITE = { r: 255, g: 255, b: 255 };

// A width × height photo of `background` with a navy box in the middle,
// optionally with a white patch inside it.
async function photo({
  background = WHITE,
  width = 200,
  height = 250,
  item = { left: 50, top: 60, width: 100, height: 120 },
  innerPatch = false,
} = {}) {
  const layers: OverlayOptions[] = [
    {
      input: { create: { width: item.width, height: item.height, channels: 3, background: { r: 20, g: 30, b: 80 } } },
      left: item.left,
      top: item.top,
    },
  ];
  if (innerPatch) {
    layers.push({
      input: { create: { width: 20, height: 20, channels: 3, background: WHITE } },
      left: item.left + 40,
      top: item.top + 50,
    });
  }
  return sharp({ create: { width, height, channels: 3, background } }).composite(layers).png().toBuffer();
}

async function pixels(webp: Buffer) {
  const { data, info } = await sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
  return { info, alphaAt };
}

describe("cutOut", () => {
  it("clears a white background and trims to the item", async () => {
    const out = await cutOut(await photo());
    expect(out).not.toBeNull();
    const { info, alphaAt } = await pixels(out!);
    expect(info.width).toBeLessThanOrEqual(102);
    expect(info.height).toBeLessThanOrEqual(122);
    expect(alphaAt(Math.floor(info.width / 2), Math.floor(info.height / 2))).toBe(255);
  });

  it("clears a light grey studio background too", async () => {
    const out = await cutOut(await photo({ background: { r: 236, g: 236, b: 234 } }));
    expect(out).not.toBeNull();
  });

  it("keeps light parts inside the item", async () => {
    const out = await cutOut(await photo({ innerPatch: true }));
    const { info, alphaAt } = await pixels(out!);
    // The white patch sits 40-60 px across and 50-70 px down inside the item.
    expect(alphaAt(Math.min(50, info.width - 1), Math.min(60, info.height - 1))).toBe(255);
  });

  it("leaves dark or busy backgrounds alone", async () => {
    expect(await cutOut(await photo({ background: { r: 60, g: 60, b: 60 } }))).toBeNull();
    // The item runs off the left and right edges: most of the edge isn't background.
    expect(await cutOut(await photo({ item: { left: 0, top: 0, width: 200, height: 230 } }))).toBeNull();
  });

  it("clears small specks apart from the item, like a store badge", async () => {
    const badge = await sharp({ create: { width: 12, height: 8, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer();
    const withBadge = await sharp(await photo()).composite([{ input: badge, left: 6, top: 6 }]).png().toBuffer();
    const { info } = await pixels((await cutOut(withBadge))!);
    // Trimmed to the item alone, not stretched up to the badge.
    expect(info.width).toBeLessThanOrEqual(102);
    expect(info.height).toBeLessThanOrEqual(122);
  });

  it("gives up when the item would vanish", async () => {
    expect(await cutOut(await photo({ item: { left: 99, top: 124, width: 2, height: 2 } }))).toBeNull();
  });

  it("shrinks large photos", async () => {
    const out = await cutOut(await photo({ width: 1600, height: 2000, item: { left: 100, top: 100, width: 1400, height: 1800 } }));
    const { info } = await pixels(out!);
    expect(Math.max(info.width, info.height)).toBeLessThanOrEqual(640);
  });
});
