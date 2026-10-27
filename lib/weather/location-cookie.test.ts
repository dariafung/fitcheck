import { describe, expect, it } from "vitest";
import { cookieString, cookieValue } from "../cookie";
import {
  clearLocationCookieString,
  LOCATION_COOKIE,
  locationCookieString,
  MAX_CITY_LENGTH,
  parseLocationCookie,
  readLocationCookie,
} from "./location-cookie";

// What document.cookie would send back after the page writes `setCookie`.
function sent(setCookie: string): string {
  return setCookie.split(";")[0];
}

describe("cookie helpers", () => {
  it("finds one cookie among several and decodes it", () => {
    expect(cookieValue("a=1; fc_units=metric; b=2", "fc_units")).toBe("metric");
    expect(cookieValue(sent(cookieString("x", "a b;c")), "x")).toBe("a b;c");
    expect(cookieValue("a=1", "x")).toBeNull();
    expect(cookieValue(null, "x")).toBeNull();
    expect(cookieValue("x=%E0%A4%A", "x")).toBeNull();
  });

  it("writes a year-long, site-wide cookie and deletes with max-age 0", () => {
    expect(cookieString("x", "1")).toBe("x=1; Path=/; Max-Age=31536000; SameSite=Lax");
    expect(clearLocationCookieString()).toContain("Max-Age=0");
  });
});

describe("location cookie", () => {
  it("round-trips a picked city with coordinates rounded to ~1 km", () => {
    const set = locationCookieString({ src: "picked", lat: 41.87811, lon: -87.62980, city: "Chicago, Illinois, US" });
    expect(readLocationCookie(new Headers({ cookie: sent(set) }))).toEqual({
      src: "picked",
      lat: 41.88,
      lon: -87.63,
      city: "Chicago, Illinois, US",
    });
  });

  it("stores no city for the device's own location", () => {
    const set = locationCookieString({ src: "device", lat: 43.0731, lon: -89.4012 });
    expect(readLocationCookie(new Headers({ cookie: sent(set) }))).toEqual({ src: "device", lat: 43.07, lon: -89.4 });
  });

  it("treats anything malformed as no cookie", () => {
    expect(parseLocationCookie(null)).toBeNull();
    expect(parseLocationCookie("{")).toBeNull();
    expect(parseLocationCookie(JSON.stringify({ src: "picked", lat: 1, lon: 2 }))).toBeNull();
    expect(parseLocationCookie(JSON.stringify({ src: "device", lat: 91, lon: 2 }))).toBeNull();
    expect(parseLocationCookie(JSON.stringify({ src: "device", lat: 1, lon: -181 }))).toBeNull();
    expect(parseLocationCookie(JSON.stringify({ src: "ip", lat: 1, lon: 2 }))).toBeNull();
    const long = "x".repeat(MAX_CITY_LENGTH + 1);
    expect(parseLocationCookie(JSON.stringify({ src: "picked", lat: 1, lon: 2, city: long }))).toBeNull();
    expect(readLocationCookie(new Headers({ cookie: `${LOCATION_COOKIE}=oops` }))).toBeNull();
  });
});
