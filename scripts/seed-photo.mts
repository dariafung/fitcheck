// Makes the photo of one seed neighbor's piece (seed/neighbors.json) from a
// screenshot of its product page, the way adding an item frames it: the box
// is cropped out (productPhoto), then a plain light backdrop is lifted to
// white and the garment centered on the white 4:5 canvas (frameOriginal).
// Free: no model call, so an on-model photo keeps the person; pick a
// flat-lay or product-only shot.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/seed-photo.mts \
//     <item id> <screenshot.png> <x,y,width,height | whole>
//
// The box is the product photo inside the screenshot as fractions (0–1) of
// its width and height, like productBox. Writes seed/images/<item id>.webp
// and points the piece's image_paths (and raw_source) at it. Run `pnpm seed`
// afterwards to upload it.
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import "./lib/app-imports.mjs";

const { productPhoto } = (await import(new URL("../lib/entry/screenshot.ts", import.meta.url).href)) as typeof import(
  "../lib/entry/screenshot"
);
const { frameOriginal } = (await import(new URL("../lib/entry/frame.ts", import.meta.url).href)) as typeof import(
  "../lib/entry/frame"
);

const [itemId, screenshotPath, boxArg] = process.argv.slice(2);
if (!itemId || !screenshotPath || !boxArg) {
  throw new Error("Usage: seed-photo.mts <item id> <screenshot.png> <x,y,width,height | whole>");
}

const NEIGHBORS = new URL("../seed/neighbors.json", import.meta.url);
const neighbors = JSON.parse(readFileSync(NEIGHBORS, "utf8")) as {
  users: unknown[];
  items: { id: string; user_id: string; title: string; image_paths: string[]; raw_source?: unknown }[];
};
const piece = neighbors.items.find((i) => i.id === itemId);
if (!piece) throw new Error(`No piece ${itemId} in seed/neighbors.json.`);

let box: { x: number; y: number; width: number; height: number } | undefined;
if (boxArg !== "whole") {
  const [x, y, width, height] = boxArg.split(",").map(Number);
  if (![x, y, width, height].every((n) => Number.isFinite(n) && n >= 0 && n <= 1) || width <= 0 || height <= 0) {
    throw new Error(`Not a box of four fractions: ${boxArg}`);
  }
  box = { x, y, width, height };
}

const data = readFileSync(screenshotPath);
const meta = await sharp(data).metadata();
if (!meta.width || !meta.height || !meta.format) throw new Error(`Can't read ${screenshotPath} as an image.`);
const shot = { data, mime: `image/${meta.format}`, width: meta.width, height: meta.height };
const { webp, cropped } = await productPhoto(shot, box);
if (box && !cropped) throw new Error("The box is outside the screenshot or too small to be a product photo.");
const framed = await frameOriginal(webp);
writeFileSync(new URL(`../seed/images/${itemId}.webp`, import.meta.url), framed);

piece.image_paths = [`${piece.user_id}/${itemId}.webp`];
piece.raw_source = {
  cropped,
  ...(box && { productBox: box }),
  screenshot: { mime: shot.mime, width: shot.width, height: shot.height },
};
writeFileSync(NEIGHBORS, `${JSON.stringify(neighbors, null, 2)}\n`);
console.log(`Framed ${piece.title} → seed/images/${itemId}.webp`);
