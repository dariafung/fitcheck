// What size advice reads: every piece of the user's with a size and a word on
// how it fit. Pieces being passed on count too: those are often the ones
// that didn't fit.
import type { Db } from "../db/server";
import type { UsualSizes, WornSize } from "./advice";
import { SizeFit } from "./fit";

export async function loadSizeHistory(
  db: Db,
  userId: string,
): Promise<{ worn: WornSize[]; usual: UsualSizes }> {
  const [{ data: items }, { data: user }] = await Promise.all([
    db
      .from("items")
      .select("brand, category, size, size_fit")
      .eq("user_id", userId)
      .not("size", "is", null)
      .not("size_fit", "is", null)
      .order("id")
      .throwOnError(),
    db.from("users").select("top_size, bottom_size, shoe_size").eq("id", userId).maybeSingle().throwOnError(),
  ]);
  return {
    worn: items.flatMap(({ brand, category, size, size_fit }) => {
      const fit = SizeFit.safeParse(size_fit);
      return size && fit.success ? [{ brand, category, size, sizeFit: fit.data }] : [];
    }),
    usual: { top: user?.top_size ?? null, bottom: user?.bottom_size ?? null, shoe: user?.shoe_size ?? null },
  };
}
