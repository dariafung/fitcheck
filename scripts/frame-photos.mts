// Frames item photos saved before every photo was framed on white: a plain
// light backdrop is lifted to white, the photo trimmed to the garment and
// centered on the white 4:5 canvas (lib/entry/frame.ts). Free, no model call.
// On-model photos that were never cut out are framed too but still show the
// person; they are listed so they can be cut out separately.
//
// Dry run by default: lists what would change. --apply writes.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/frame-photos.mts [--apply]
//     every item in the database. Local by default (.env.local) and refuses
//     any other URL; FRAME_REMOTE=1 works on the hosted project instead
//     (SUPABASE_URL and SUPABASE_SECRET_KEY from the environment, the project
//     ref typed back to confirm). The new photo replaces the first one in
//     image_paths; the old one is left to the daily cleanup of unused photos.
//   ... scripts/frame-photos.mts --seed [--apply]
//     seed/images/ in place, for the photos seed/items.json lists.
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

// Node runs the TypeScript file as it is; tsc only checks the types.
const { CANVAS_HEIGHT, CANVAS_WIDTH, frameOnWhite, frameOriginal } = (await import(
  new URL("../lib/entry/frame.ts", import.meta.url).href
)) as typeof import("../lib/entry/frame");

const ITEM_IMAGES_BUCKET = "item-images";
const apply = process.argv.includes("--apply");

interface Photo {
  title: string;
  on_model: boolean;
  raw_source: unknown;
}

const cutOutByAi = (item: Photo) => (item.raw_source as { cutOutByAi?: boolean } | null)?.cutOutByAi === true;

async function framed(photo: Buffer): Promise<boolean> {
  const { width, height } = await sharp(photo).metadata();
  return width === CANVAS_WIDTH && height === CANVAS_HEIGHT;
}

// An AI cut-out is on white already; anything else may have a backdrop to lift.
function frame(item: Photo, photo: Buffer): Promise<Buffer> {
  return cutOutByAi(item) ? frameOnWhite(photo) : frameOriginal(photo);
}

function report(item: Photo, note = "") {
  const person = item.on_model && !cutOutByAi(item) ? " (on model: still shows the person)" : "";
  console.log(`${apply ? "framed" : "would frame"}: ${item.title}${person}${note}`);
}

async function frameSeed() {
  const items = JSON.parse(readFileSync(new URL("../seed/items.json", import.meta.url), "utf8")) as (Photo & {
    image_paths?: string[];
  })[];
  let count = 0;
  for (const item of items) {
    const name = item.image_paths?.[0]?.split("/").pop();
    if (!name) continue;
    const file = new URL(`../seed/images/${name}`, import.meta.url);
    const photo = readFileSync(file);
    if (await framed(photo)) continue;
    const out = await frame(item, photo);
    if (apply) writeFileSync(file, out);
    report(item, ` → seed/images/${name}`);
    count++;
  }
  console.log(`${count} seed photo(s) ${apply ? "framed" : "to frame; run again with --apply"}.`);
}

async function frameDatabase() {
  const remote = process.env.FRAME_REMOTE === "1";
  if (!remote) process.loadEnvFile(".env.local");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error(remote ? "Set SUPABASE_URL and SUPABASE_SECRET_KEY." : "Run `pnpm env:local` first.");
  if (remote) {
    const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(url)?.[1];
    if (!ref) throw new Error(`Not a hosted Supabase URL: ${url}`);
    if (apply) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const typed = await rl.question(`Framing item photos in project ${ref}. Type the ref to go on: `);
      rl.close();
      if (typed.trim() !== ref) throw new Error("Ref did not match; nothing was changed.");
    }
  } else if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    throw new Error(`Refusing a non-local database: ${url} (FRAME_REMOTE=1 works on the hosted project)`);
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  const bucket = db.storage.from(ITEM_IMAGES_BUCKET);
  const { data: items, error } = await db.from("items").select("id, user_id, title, on_model, raw_source, image_paths");
  if (error) throw error;
  let count = 0;
  for (const item of items) {
    const [first, ...rest] = item.image_paths as string[];
    if (!first) continue;
    const { data, error: downloadError } = await bucket.download(first);
    if (downloadError) {
      console.log(`skipped (photo missing): ${item.title}`);
      continue;
    }
    const photo = Buffer.from(await data.arrayBuffer());
    if (await framed(photo)) continue;
    if (apply) {
      const path = `${item.user_id}/${randomUUID()}.webp`;
      const uploaded = await bucket.upload(path, await frame(item, photo), { contentType: "image/webp" });
      if (uploaded.error) throw uploaded.error;
      const updated = await db.from("items").update({ image_paths: [path, ...rest] }).eq("id", item.id);
      if (updated.error) throw updated.error;
    }
    report(item);
    count++;
  }
  console.log(`${count} item photo(s) ${apply ? "framed" : "to frame; run again with --apply"}.`);
}

await (process.argv.includes("--seed") ? frameSeed() : frameDatabase());
