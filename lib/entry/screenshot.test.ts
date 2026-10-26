import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, pixelBox, productPhoto, readScreenshot } from "./screenshot";

function png(width: number, height: number, color = "#ffffff") {
  return sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
}

describe("readScreenshot", () => {
  it("reads a PNG screenshot", async () => {
    const shot = await readScreenshot(new Blob([await png(1170, 2000)]));
    expect(shot).toMatchObject({ mime: "image/png", width: 1170, height: 2000 });
  });

  it.each([
    ["text", async () => new Blob(["not an image"]), "not_image"],
    ["a GIF", async () => new Blob([await sharp(await png(400, 400)).gif().toBuffer()]), "not_image"],
    ["a tiny image", async () => new Blob([await png(200, 800)]), "too_small"],
    ["an oversized file", async () => new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)]), "too_large"],
  ])("refuses %s", async (_, make, error) => {
    expect(await readScreenshot(await make())).toEqual({ error });
  });
});

describe("pixelBox", () => {
  it("turns fractions into pixels", () => {
    expect(pixelBox({ x: 0.1, y: 0.12, width: 0.8, height: 0.5 }, 1000, 2000)).toEqual({
      left: 100,
      top: 240,
      width: 800,
      height: 1000,
    });
  });

  it("clamps a box that rounds just past the edge", () => {
    expect(pixelBox({ x: 0.5, y: -0.01, width: 0.51, height: 0.5 }, 1000, 1000)).toEqual({
      left: 500,
      top: 0,
      width: 500,
      height: 490,
    });
  });

  it.each([
    ["missing", undefined],
    ["outside", { x: 0.6, y: 0.1, width: 0.6, height: 0.5 }],
    ["negative", { x: -0.2, y: 0.1, width: 0.5, height: 0.5 }],
    ["too small", { x: 0.1, y: 0.1, width: 0.05, height: 0.5 }],
    ["zero", { x: 0.1, y: 0.1, width: 0, height: 0.5 }],
    ["not a number", { x: Number.NaN, y: 0.1, width: 0.5, height: 0.5 }],
    ["in pixels by mistake", { x: 100, y: 200, width: 500, height: 600 }],
  ])("rejects a box that is %s", (_, box) => {
    expect(pixelBox(box, 1000, 1000)).toBeUndefined();
  });
});

describe("productPhoto", () => {
  it("crops the product out of the screenshot", async () => {
    // Red product photo on a white page.
    const data = await sharp(await png(1000, 2000))
      .composite([{ input: await png(800, 1000, "#c0392b"), left: 100, top: 240 }])
      .png()
      .toBuffer();
    const shot = { data, mime: "image/png", width: 1000, height: 2000 };
    const photo = await productPhoto(shot, { x: 0.1, y: 0.12, width: 0.8, height: 0.5 });
    expect(photo.cropped).toBe(true);
    const meta = await sharp(photo.webp).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 800, height: 1000 });
    const { dominant } = await sharp(photo.webp).stats();
    expect(dominant.r).toBeGreaterThan(150);
    expect(dominant.g).toBeLessThan(100);
  });

  it("falls back to the whole screenshot, shrunk to 1600 px", async () => {
    const shot = { data: await png(1170, 2532), mime: "image/png", width: 1170, height: 2532 };
    const photo = await productPhoto(shot, { x: 2, y: 0, width: 1, height: 1 });
    expect(photo.cropped).toBe(false);
    expect(await sharp(photo.webp).metadata()).toMatchObject({ height: 1600 });
  });
});
