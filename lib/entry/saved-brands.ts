import type { Db } from "@/lib/db/server";
import { savedBrandNames } from "./brands";

// The brands on a user's saved items (passing-on ones too), one spelling
// each, the most saved first.
export async function savedBrands(db: Db, userId: string): Promise<string[]> {
  const { data, error } = await db
    .from("items")
    .select("brand, created_at")
    .eq("user_id", userId)
    .not("brand", "is", null);
  if (error) throw error;
  return savedBrandNames(data.map((row) => ({ brand: row.brand ?? "", savedAt: row.created_at })));
}
