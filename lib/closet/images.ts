import type { Db } from "@/lib/db/server";

export const ITEM_IMAGES_BUCKET = "item-images";
const SIGNED_URL_SECONDS = 60 * 60;

export function isExternalUrl(path: string): boolean {
  return /^https?:\/\//i.test(path);
}

// `items.image_paths` holds either full URLs, used as they are, or paths in
// the private item-images bucket, which get short-lived signed URLs. Order is
// kept; paths that cannot be signed are dropped.
export async function imageUrls(db: Db, paths: string[]): Promise<string[]> {
  const stored = paths.filter((p) => !isExternalUrl(p));
  const signed = new Map<string, string>();
  if (stored.length > 0) {
    const { data, error } = await db.storage
      .from(ITEM_IMAGES_BUCKET)
      .createSignedUrls(stored, SIGNED_URL_SECONDS);
    if (error) throw error;
    for (const s of data) {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
  }
  return paths.flatMap((p) => {
    const url = isExternalUrl(p) ? p : signed.get(p);
    return url ? [url] : [];
  });
}
