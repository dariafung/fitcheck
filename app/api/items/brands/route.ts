import { connection } from "next/server";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { savedBrands } from "@/lib/entry/saved-brands";

// GET → { brands }: the current user's own brand spellings, most saved
// first, for the item card to suggest while typing.
export async function GET() {
  await connection();
  return Response.json({ brands: await savedBrands(createServerClient(), await currentUserId()) });
}
