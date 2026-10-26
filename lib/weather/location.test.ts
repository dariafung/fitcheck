import { describe, expect, it } from "vitest";
import { DEFAULT_LOCATION, locationFromHeaders, resolveLocation } from "./location";

describe("locationFromHeaders", () => {
  it("reads Vercel's IP headers and decodes the city", () => {
    const headers = new Headers({
      "x-vercel-ip-latitude": "41.88",
      "x-vercel-ip-longitude": "-87.63",
      "x-vercel-ip-city": "S%C3%A3o%20Paulo",
    });
    expect(locationFromHeaders(headers)).toEqual({ lat: 41.88, lon: -87.63, city: "São Paulo" });
  });

  it("is null without usable coordinates", () => {
    expect(locationFromHeaders(new Headers())).toBeNull();
    expect(locationFromHeaders(new Headers({ "x-vercel-ip-latitude": "abc", "x-vercel-ip-longitude": "1" }))).toBeNull();
    expect(locationFromHeaders(new Headers({ "x-vercel-ip-latitude": "91", "x-vercel-ip-longitude": "1" }))).toBeNull();
  });

  it("keeps the location when the city is missing", () => {
    const headers = new Headers({ "x-vercel-ip-latitude": "1.5", "x-vercel-ip-longitude": "2.5" });
    expect(locationFromHeaders(headers)).toEqual({ lat: 1.5, lon: 2.5, city: null });
  });
});

describe("resolveLocation", () => {
  it("falls back to Madison when nothing else is known", async () => {
    expect(await resolveLocation("user", new Headers())).toEqual(DEFAULT_LOCATION);
  });
});
