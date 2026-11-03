import sharp, { type OverlayOptions } from "sharp";
import { describe, expect, it } from "vitest";
import { CANVAS_HEIGHT, CANVAS_WIDTH, MARGIN, frameOnWhite, frameOriginal, needsCutout } from "./frame";
import { productPhoto } from "./screenshot";

const WHITE = { r: 255, g: 255, b: 255 };
const NAVY = { r: 20, g: 30, b: 80 };

// A width × height photo of `background` with navy boxes on it.
async function photo({
  background = WHITE as { r: number; g: number; b: number; alpha?: number },
  width = 400,
  height = 400,
  boxes = [{ left: 20, top: 30, width: 100, height: 100 }],
  channels = 3 as 3 | 4,
} = {}) {
  const layers: OverlayOptions[] = boxes.map((b) => ({
    input: { create: { width: b.width, height: b.height, channels: 3, background: NAVY } },
    left: b.left,
    top: b.top,
  }));
  return sharp({ create: { width, height, channels, background } }).composite(layers).png().toBuffer();
}

// The bounding box of the non-white pixels in a framed photo.
async function garmentBox(webp: Buffer) {
  const { data, info } = await sharp(webp).raw().toBuffer({ resolveWithObject: true });
  let [left, top, right, bottom] = [info.width, info.height, -1, -1];
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return { info, left, top, width: right - left + 1, height: bottom - top + 1 };
}

const innerWidth = CANVAS_WIDTH * (1 - 2 * MARGIN);
const innerHeight = CANVAS_HEIGHT * (1 - 2 * MARGIN);

function expectCentered(box: Awaited<ReturnType<typeof garmentBox>>) {
  expect(Math.abs(box.left - (CANVAS_WIDTH - box.width) / 2)).toBeLessThanOrEqual(3);
  expect(Math.abs(box.top - (CANVAS_HEIGHT - box.height) / 2)).toBeLessThanOrEqual(3);
}

describe("frameOnWhite", () => {
  it("centers a small off-center garment on the 4:5 canvas, scaled up to the margin", async () => {
    const box = await garmentBox(await frameOnWhite(await photo()));
    expect(box.info).toMatchObject({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
    expectCentered(box);
    // A square garment touches the side margins.
    expect(Math.abs(box.width - innerWidth)).toBeLessThanOrEqual(3);
    expect(box.height).toBeLessThanOrEqual(innerHeight);
  });

  it("fits a tall garment to the top and bottom margins and a wide one to the sides", async () => {
    const tall = await garmentBox(await frameOnWhite(await photo({ boxes: [{ left: 150, top: 10, width: 60, height: 300 }] })));
    expectCentered(tall);
    expect(Math.abs(tall.height - innerHeight)).toBeLessThanOrEqual(3);
    expect(tall.width).toBeLessThan(innerWidth);

    const wide = await garmentBox(await frameOnWhite(await photo({ boxes: [{ left: 10, top: 300, width: 300, height: 80 }] })));
    expectCentered(wide);
    expect(Math.abs(wide.width - innerWidth)).toBeLessThanOrEqual(3);
    expect(wide.height).toBeLessThan(innerHeight);
  });

  it("frames two pieces (a pair of shoes) as one", async () => {
    const pair = await garmentBox(
      await frameOnWhite(
        await photo({
          boxes: [
            { left: 40, top: 100, width: 80, height: 60 },
            { left: 200, top: 120, width: 80, height: 60 },
          ],
        }),
      ),
    );
    expectCentered(pair);
    expect(Math.abs(pair.width - innerWidth)).toBeLessThanOrEqual(3);
  });

  it("centers the garment, not the product name or a thumbnail edge taken in with it", async () => {
    // A jacket with a line of "text" under it and a sliver of the next photo
    // at the side, as a padded crop of a store page takes them in.
    const box = await garmentBox(
      await frameOnWhite(
        await photo({
          width: 400,
          height: 560,
          boxes: [
            { left: 120, top: 60, width: 200, height: 220 },
            ...[0, 1, 2, 3, 4, 5].map((i) => ({ left: 60 + i * 22, top: 470, width: 16, height: 10 })),
            { left: 0, top: 80, width: 12, height: 150 },
          ],
        }),
      ),
    );
    expectCentered(box);
    // Only the jacket is framed, so it reaches the side margins.
    expect(Math.abs(box.width - innerWidth)).toBeLessThanOrEqual(3);
  });

  it("turns a transparent background white", async () => {
    const out = await frameOnWhite(await photo({ background: { ...WHITE, alpha: 0 }, channels: 4 }));
    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]]).toEqual([255, 255, 255]);
    expect(info.channels).toBe(3);
  });

  it("ignores a faint shadow and a stray speck", async () => {
    const base = await sharp(await photo({ boxes: [{ left: 100, top: 100, width: 200, height: 200 }] }))
      .composite([
        // A shadow 6 levels below white, and a 1 px speck in a corner.
        { input: { create: { width: 380, height: 20, channels: 3, background: { r: 249, g: 249, b: 249 } } }, left: 10, top: 340 },
        { input: { create: { width: 1, height: 1, channels: 3, background: NAVY } }, left: 2, top: 2 },
      ])
      .png()
      .toBuffer();
    const box = await garmentBox(await frameOnWhite(base));
    expectCentered(box);
    expect(Math.abs(box.width - innerWidth)).toBeLessThanOrEqual(3);
  });

  it("keeps a near-white garment's edge", async () => {
    const cream = await sharp({ create: { width: 400, height: 400, channels: 3, background: WHITE } })
      .composite([{ input: { create: { width: 100, height: 100, channels: 3, background: { r: 238, g: 236, b: 230 } } }, left: 20, top: 30 }])
      .png()
      .toBuffer();
    const { data, info } = await sharp(await frameOnWhite(cream)).raw().toBuffer({ resolveWithObject: true });
    // Trimmed to the cream square, so it reaches the side margin.
    const at = (x: number, y: number) => data[(y * info.width + x) * info.channels + 2];
    const y = Math.round(CANVAS_HEIGHT / 2);
    expect(at(Math.round(CANVAS_WIDTH * MARGIN) + 4, y)).toBeLessThan(240);
    // (WebP blurs the edge by a level or two.)
    expect(at(Math.round(CANVAS_WIDTH * MARGIN) - 4, y)).toBeGreaterThanOrEqual(250);
  });

  it("places an all-white photo whole instead of failing", async () => {
    const out = await frameOnWhite(await photo({ boxes: [] }));
    expect(await sharp(out).metadata()).toMatchObject({ format: "webp", width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
  });
});

describe("frameOriginal", () => {
  it("swaps a plain light grey background for white", async () => {
    const out = await frameOriginal(await photo({ background: { r: 236, g: 236, b: 234 } }));
    const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]]).toEqual([255, 255, 255]);
    expectCentered(await garmentBox(out));
  });

  it("lifts a grey photo cropped with a strip of the white page around it", async () => {
    const grey = await sharp({ create: { width: 400, height: 400, channels: 3, background: WHITE } })
      .composite([
        { input: { create: { width: 360, height: 360, channels: 3, background: { r: 239, g: 239, b: 237 } } }, left: 0, top: 0 },
        { input: { create: { width: 100, height: 100, channels: 3, background: NAVY } }, left: 130, top: 130 },
      ])
      .png()
      .toBuffer();
    const { data } = await sharp(await frameOriginal(grey)).raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]]).toEqual([255, 255, 255]);
  });

  it("doesn't mistake a pale garment cropped at the edge for the background", async () => {
    // A light grey tee (body and sleeves) whose hem runs off the bottom of the photo.
    const pale = { r: 236, g: 238, b: 240 };
    const tee = await sharp({ create: { width: 400, height: 400, channels: 3, background: WHITE } })
      .composite([
        { input: { create: { width: 300, height: 60, channels: 3, background: pale } }, left: 50, top: 150 },
        { input: { create: { width: 180, height: 250, channels: 3, background: pale } }, left: 110, top: 150 },
      ])
      .png()
      .toBuffer();
    const out = await frameOriginal(tee);
    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    const center = (Math.round(CANVAS_HEIGHT / 2) * info.width + Math.round(CANVAS_WIDTH / 2)) * info.channels;
    expect(data[center]).toBeLessThan(245);
  });

  it("keeps a busy or dark background, framed on white", async () => {
    const out = await frameOriginal(await photo({ background: { r: 60, g: 90, b: 40 } }));
    const box = await garmentBox(out);
    expect(box.info).toMatchObject({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
    // The whole photo is the "garment": a square touching the side margins.
    expectCentered(box);
    expect(Math.abs(box.width - innerWidth)).toBeLessThanOrEqual(3);
  });
});

describe("judging the backdrop on the model's own crop", () => {
  it("still lifts a full-width grey photo for free when the padding takes in the product name", async () => {
    // A store page: a grey product photo the full width of the screen with a
    // navy garment on it, and a line of dark "text" on white below.
    const grey = { r: 232, g: 232, b: 232 };
    const data = await sharp({ create: { width: 1000, height: 1500, channels: 3, background: WHITE } })
      .composite([
        { input: { create: { width: 1000, height: 1100, channels: 3, background: grey } }, left: 0, top: 0 },
        { input: { create: { width: 400, height: 600, channels: 3, background: NAVY } }, left: 300, top: 250 },
        ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
          input: { create: { width: 30, height: 18, channels: 3 as const, background: NAVY } },
          left: 100 + i * 40,
          top: 1130,
        })),
      ])
      .png()
      .toBuffer();
    const shot = { data, mime: "image/png", width: 1000, height: 1500 };
    const photo = await productPhoto(shot, { x: 0, y: 0, width: 1, height: 1100 / 1500 });
    expect(await needsCutout(photo.webp, photo.probe)).toBe(false);

    const framed = await frameOriginal(photo.webp, photo.probe);
    const { data: px, info } = await sharp(framed).raw().toBuffer({ resolveWithObject: true });
    // The grey went white, and the garment (not the text) is centered.
    expect(Math.min(px[0], px[1], px[2])).toBeGreaterThanOrEqual(250);
    expect(info).toMatchObject({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
    expectCentered(await garmentBox(framed));
  });
});

describe("needsCutout", () => {
  // A grey backdrop that fades to white towards the bottom right, floating on
  // the white page, with a pale tee on it.
  async function fadingBackdrop() {
    const width = 300;
    const height = 300;
    const rgb = Buffer.alloc(width * height * 3, 255);
    for (let y = 0; y < 280; y++) {
      for (let x = 10; x < 290; x++) {
        const fade = Math.max(0, (x - 150) / 140, (y - 140) / 140);
        rgb.fill(Math.round(232 + 23 * Math.min(1, fade)), (y * width + x) * 3, (y * width + x) * 3 + 3);
      }
    }
    return sharp(rgb, { raw: { width, height, channels: 3 } })
      .composite([{ input: { create: { width: 120, height: 140, channels: 3, background: { r: 215, g: 215, b: 218 } } }, left: 90, top: 70 }])
      .png()
      .toBuffer();
  }

  it("sends a photo on a backdrop that can't be lifted to white to the model", async () => {
    expect(await needsCutout(await fadingBackdrop())).toBe(true);
    expect(await needsCutout(await photo({ background: { r: 60, g: 90, b: 40 } }))).toBe(true);
  });

  it("keeps a photo that is on white, or on a plain light backdrop, for free", async () => {
    // A garment's outline touches its bounding box only here and there.
    const round = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#fff"/><ellipse cx="200" cy="200" rx="120" ry="160" fill="#142050"/></svg>',
    );
    expect(await needsCutout(await sharp(round).png().toBuffer())).toBe(false);
    expect(await needsCutout(await photo({ background: { r: 236, g: 236, b: 234 } }))).toBe(false);
    expect(await needsCutout(await photo({ boxes: [] }))).toBe(false);
  });

  it("doesn't mistake a pale garment cropped at the edge for a backdrop", async () => {
    const pale = { r: 236, g: 238, b: 240 };
    const tee = await sharp({ create: { width: 400, height: 400, channels: 3, background: WHITE } })
      .composite([
        { input: { create: { width: 300, height: 60, channels: 3, background: pale } }, left: 50, top: 150 },
        { input: { create: { width: 180, height: 250, channels: 3, background: pale } }, left: 110, top: 150 },
      ])
      .png()
      .toBuffer();
    expect(await needsCutout(tee)).toBe(false);
  });
});
