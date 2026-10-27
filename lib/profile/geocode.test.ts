import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIXED_CITIES, geocodingUrl, searchCities } from "./geocode";

const ANSWER = {
  results: [
    { name: "Springfield", latitude: 39.80172, longitude: -89.64371, admin1: "Illinois", country_code: "US" },
    { name: "Springfield", latitude: 39.8, longitude: -89.6, admin1: "Illinois", country_code: "US" },
    { name: "Singapore", latitude: 1.28967, longitude: 103.85007, admin1: "Singapore", country: "Singapore" },
  ],
};

let urls: string[] = [];
function answering(body: unknown, status = 200) {
  return (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  urls = [];
  vi.stubEnv("WEATHER_MODE", "live");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("searchCities", () => {
  it("labels and de-duplicates Open-Meteo's matches", async () => {
    expect(await searchCities(" spring ", { fetchImpl: answering(ANSWER) })).toEqual([
      { label: "Springfield, Illinois, US", lat: 39.8, lon: -89.64 },
      { label: "Singapore, Singapore", lat: 1.29, lon: 103.85 },
    ]);
    expect(urls).toEqual([geocodingUrl("spring")]);
    expect(urls[0]).toContain("count=5");
  });

  it("is empty when nothing matches", async () => {
    expect(await searchCities("zzzz", { fetchImpl: answering({ generationtime_ms: 0.1 }) })).toEqual([]);
  });

  it("does not ask for queries under 2 characters", async () => {
    expect(await searchCities(" c ", { fetchImpl: answering(ANSWER) })).toEqual([]);
    expect(urls).toEqual([]);
  });

  it("throws when the service fails", async () => {
    await expect(searchCities("chicago", { fetchImpl: answering({ error: true }, 400) })).rejects.toThrow();
    const offline = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    await expect(searchCities("chicago", { fetchImpl: offline })).rejects.toThrow("offline");
  });

  it("searches the fixed list without the network in fixed mode", async () => {
    vi.stubEnv("WEATHER_MODE", "fixed");
    expect(await searchCities("chi", { fetchImpl: answering(ANSWER) })).toEqual([FIXED_CITIES[0]]);
    expect(await searchCities("nowhere", { fetchImpl: answering(ANSWER) })).toEqual([]);
    expect(urls).toEqual([]);
  });
});
