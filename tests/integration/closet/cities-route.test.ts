import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cities/route";
import { FIXED_CITIES } from "@/lib/profile/geocode";

// Never reaches Open-Meteo: fixed mode searches FIXED_CITIES, and live mode
// gets a stubbed fetch.
function search(q: string) {
  return GET(new Request(`http://test/api/cities?q=${encodeURIComponent(q)}`));
}

beforeEach(() => {
  vi.stubEnv("WEATHER_MODE", "fixed");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/cities", () => {
  it("returns matching cities", async () => {
    const res = await search("Chic");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cities: [FIXED_CITIES[0]] });
  });

  it("returns nothing for a 1-letter query", async () => {
    expect(await (await search("c")).json()).toEqual({ cities: [] });
  });

  it("asks Open-Meteo in live mode and says so when it fails", async () => {
    vi.stubEnv("WEATHER_MODE", "live");
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ error: true, reason: "nope" }), { status: 400 }));
    vi.stubGlobal("fetch", fetchSpy);
    const res = await search("Chicago");
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Search isn't working right now." });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
