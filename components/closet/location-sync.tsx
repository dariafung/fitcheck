"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { cookieString, cookieValue, writeCookie } from "@/lib/cookie";
import {
  clearLocationCookieString,
  GEO_ASKED_COOKIE,
  LOCATION_COOKIE,
  locationCookieString,
  parseLocationCookie,
  roundCoord,
} from "@/lib/weather/location-cookie";

async function permissionState(): Promise<PermissionState | null> {
  try {
    return (await navigator.permissions?.query({ name: "geolocation" }))?.state ?? null;
  } catch {
    return null;
  }
}

// Keeps the home page's weather on the device's own location. Asks for
// permission once per browser (first home visit); after that it only reads
// the position when already allowed. A picked city always wins. Failures
// stay quiet: the server falls back to the IP guess.
export function LocationSync() {
  const router = useRouter();

  useEffect(() => {
    const stored = parseLocationCookie(cookieValue(document.cookie, LOCATION_COOKIE));
    if (stored?.src === "picked" || !("geolocation" in navigator)) return;
    let cancelled = false;

    void permissionState().then((state) => {
      if (cancelled) return;
      if (state === "denied") {
        if (stored) {
          writeCookie(clearLocationCookieString());
          router.refresh();
        }
        return;
      }
      if (state !== "granted") {
        if (cookieValue(document.cookie, GEO_ASKED_COOKIE)) return;
        writeCookie(cookieString(GEO_ASKED_COOKIE, "1"));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const lat = roundCoord(pos.coords.latitude);
          const lon = roundCoord(pos.coords.longitude);
          if (stored && stored.lat === lat && stored.lon === lon) return;
          writeCookie(locationCookieString({ src: "device", lat, lon }));
          router.refresh();
        },
        () => {},
        { maximumAge: 10 * 60 * 1000, timeout: 10_000 },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
