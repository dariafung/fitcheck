import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { SCORE_PHOTO_MAX_SIDE, scoringPhoto } from "./score-photos";

describe("scoringPhoto", () => {
  it("shrinks a photo to a small webp on white", async () => {
    const png = await sharp({ create: { width: 1200, height: 1600, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toBuffer();
    const ref = await scoringPhoto(png);
    if (ref?.kind !== "inline") throw new Error("expected an inline photo");
    expect(ref.mime).toBe("image/webp");
    const out = sharp(Buffer.from(ref.base64, "base64"));
    expect(await out.metadata()).toMatchObject({ width: 384, height: SCORE_PHOTO_MAX_SIDE, hasAlpha: false });
    const { dominant } = await out.stats();
    expect(dominant).toMatchObject({ r: 248, g: 248, b: 248 });
  });

  it("leaves a small photo its size", async () => {
    const png = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#f00" } }).png().toBuffer();
    const ref = await scoringPhoto(png);
    if (ref?.kind !== "inline") throw new Error("expected an inline photo");
    expect(await sharp(Buffer.from(ref.base64, "base64")).metadata()).toMatchObject({ width: 200, height: 100 });
  });

  it("is null for something that isn't an image", async () => {
    expect(await scoringPhoto(Buffer.from("not an image"))).toBeNull();
  });
});
