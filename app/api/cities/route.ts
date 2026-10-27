import { connection } from "next/server";
import { searchCities } from "@/lib/profile/geocode";

// GET /api/cities?q=chicago → { cities: [{ label, lat, lon }] } for the
// weather location picker.
export async function GET(req: Request) {
  await connection();
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    return Response.json({ cities: await searchCities(q) });
  } catch {
    return Response.json({ error: "Search isn't working right now." }, { status: 502 });
  }
}
