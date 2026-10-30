// Cut-outs for the outfit boards on the buy-check result: the candidate's
// photo (sent back by the page, never stored) and the owned items' first
// photos. Free: no model call. A photo that can't be cut out cleanly, or
// shows a person, gets null and the page shows it as it is.
import type { Category } from "../ai/schemas/common";
import { isExternalUrl } from "../closet/images";
import type { Db } from "../db/server";
import { ITEM_IMAGES_BUCKET } from "../entry/images";
import { cutOut } from "./board";

// Three sample outfits share at most this many owned items.
export const MAX_BOARD_ITEMS = 12;
const FETCH_TIMEOUT_MS = 10_000;

export interface OwnedPiece {
  category: Category;
  // WebP data URL with a transparent background.
  cutout: string | null;
}

const DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/;

export function decodeDataUrl(url: string): Buffer | null {
  const base64 = DATA_URL.exec(url)?.[1];
  return base64 ? Buffer.from(base64, "base64") : null;
}

function toDataUrl(webp: Buffer): string {
  return `data:image/webp;base64,${webp.toString("base64")}`;
}

// Null for anything that isn't a plain-background product shot.
async function cutOutOrNull(photo: Buffer | null, onModel: boolean | null): Promise<string | null> {
  if (!photo || onModel) return null;
  const webp = await cutOut(photo).catch(() => null);
  return webp && toDataUrl(webp);
}

export function candidateCutout(photo: string, onModel: boolean): Promise<string | null> {
  return cutOutOrNull(decodeDataUrl(photo), onModel);
}

async function readPhoto(db: Db, path: string): Promise<Buffer | null> {
  try {
    if (isExternalUrl(path)) {
      const res = await fetch(path, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    }
    const { data, error } = await db.storage.from(ITEM_IMAGES_BUCKET).download(path);
    return error ? null : Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
}

// The user's active items among `ids`; anything else is left out.
export async function ownedCutouts(
  db: Db,
  userId: string,
  ids: readonly string[],
): Promise<Record<string, OwnedPiece>> {
  if (ids.length === 0) return {};
  const { data } = await db
    .from("items")
    .select("id, category, image_paths, on_model")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("id", [...ids])
    .throwOnError();
  const pieces = await Promise.all(
    data.map(async (row): Promise<[string, OwnedPiece]> => {
      const [path] = row.image_paths;
      const photo = path ? await readPhoto(db, path) : null;
      return [row.id, { category: row.category as Category, cutout: await cutOutOrNull(photo, row.on_model) }];
    }),
  );
  return Object.fromEntries(pieces);
}
