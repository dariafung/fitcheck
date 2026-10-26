// Test helper: a phone-sized "product page" screenshot with a colored product
// photo exactly where the mock extractItem's box points. Built on the fly so
// no binary fixtures live in the repo.
import sharp from "sharp";

export const SHOT = { width: 1170, height: 2000 };
// Same fractions as the mock's productBox.
export const PHOTO = { left: 117, top: 240, width: 936, height: 1000 };

export async function fakeScreenshot(
  color = "#b7472a",
  { width = SHOT.width, height = SHOT.height } = {},
): Promise<Buffer> {
  const photo = await sharp({
    create: { width: PHOTO.width, height: PHOTO.height, channels: 3, background: color },
  })
    .png()
    .toBuffer();
  return sharp({
    create: { width, height, channels: 3, background: "#ffffff" },
  })
    .composite([{ input: photo, left: PHOTO.left, top: PHOTO.top }])
    .png()
    .toBuffer();
}
