import { createHash } from "node:crypto";
import { COLOR_FAMILY_HEX } from "@/lib/color-families";

// Anonymous buyers on a seller's item: a key for the list and a circle color,
// both from a hash of the item and the buyer. Nothing about the buyer goes to
// the page, and the same buyer looks different on another item, so a seller
// can't tell they are the same person.
export const AVATAR_COLORS = [
  COLOR_FAMILY_HEX.denim,
  COLOR_FAMILY_HEX.green,
  COLOR_FAMILY_HEX.brown,
  COLOR_FAMILY_HEX.purple,
  COLOR_FAMILY_HEX.orange,
  COLOR_FAMILY_HEX.pink,
] as const;

export function anonBuyer(itemId: string, buyerId: string): { key: string; color: string } {
  const hash = createHash("sha256").update(`${itemId}:${buyerId}`).digest();
  return {
    key: hash.subarray(0, 8).toString("hex"),
    color: AVATAR_COLORS[hash[8] % AVATAR_COLORS.length],
  };
}
