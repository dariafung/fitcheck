import { describe, expect, it } from "vitest";
import { describeLocation, locationFromHeaders, resolveLocation, shortCity } from "./location";
import { LOCATION_COOKIE } from "./location-cookie";

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

const IP = { "x-vercel-ip-latitude": "47.61", "x-vercel-ip-longitude": "-122.33", "x-vercel-ip-city": "Seattle" };

function cookie(value: unknown): string {
  return `${LOCATION_COOKIE}=${encodeURIComponent(JSON.stringify(value))}`;
}

describe("resolveLocation", () => {
  it("is null when nothing is known: there is no default city", async () => {
    expect(await resolveLocation("user", new Headers())).toBeNull();
  });

  it("prefers the browser's location cookie over the IP guess", async () => {
    const picked = new Headers({ ...IP, cookie: cookie({ src: "picked", lat: 41.88, lon: -87.63, city: "Chicago, Illinois, US" }) });
    expect(await resolveLocation("user", picked)).toEqual({ lat: 41.88, lon: -87.63, city: "Chicago, Illinois, US" });

    const device = new Headers({ ...IP, cookie: `a=1; ${cookie({ src: "device", lat: 40.71, lon: -74.01 })}` });
    expect(await resolveLocation("user", device)).toEqual({ lat: 40.71, lon: -74.01, city: null });
  });

  it("ignores a malformed cookie and uses the IP guess", async () => {
    const headers = new Headers({ ...IP, cookie: `${LOCATION_COOKIE}=not-json` });
    expect(await resolveLocation("user", headers)).toEqual({ lat: 47.61, lon: -122.33, city: "Seattle" });
  });
});

describe("shortCity", () => {
  it("keeps the part before the first comma", () => {
    expect(shortCity("Chicago, Illinois, US")).toBe("Chicago");
    expect(shortCity("Seattle")).toBe("Seattle");
  });
});

describe("describeLocation", () => {
  it("names each source the way the profile page shows it", () => {
    const picked = { src: "picked", lat: 41.88, lon: -87.63, city: "Chicago, Illinois, US" };
    expect(describeLocation(new Headers({ ...IP, cookie: cookie(picked) }))).toEqual({
      label: "Chicago, Illinois, US",
      picked: true,
    });
    expect(describeLocation(new Headers({ ...IP, cookie: cookie({ src: "device", lat: 1, lon: 2 }) }))).toEqual({
      label: "Your location",
      picked: false,
    });
    expect(describeLocation(new Headers(IP))).toEqual({ label: "Seattle (best guess)", picked: false });
    expect(describeLocation(new Headers())).toEqual({ label: "Not set", picked: false });
  });
});
