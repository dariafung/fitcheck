import { describe, expect, it, vi } from "vitest";
import { fetchTodayTemps, forecastUrl } from "./open-meteo";

const FORECAST = {
  daily: { time: ["2026-10-26"], temperature_2m_min: [41.4], temperature_2m_max: [57.6] },
};

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("forecastUrl", () => {
  it("asks for today's daily low/high in Fahrenheit, local time", () => {
    const url = new URL(forecastUrl({ lat: 43.0731, lon: -89.4012 }));
    expect(url.origin + url.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      latitude: "43.07",
      longitude: "-89.40",
      daily: "temperature_2m_max,temperature_2m_min",
      temperature_unit: "fahrenheit",
      timezone: "auto",
      forecast_days: "1",
    });
  });
});

describe("fetchTodayTemps", () => {
  it("returns today's low and high in whole degrees", async () => {
    expect(await fetchTodayTemps({ lat: 1, lon: 2 }, fakeFetch(FORECAST))).toEqual({
      date: "2026-10-26",
      lowF: 41,
      highF: 58,
    });
  });

  it("throws on an error status or an unexpected body", async () => {
    await expect(fetchTodayTemps({ lat: 1, lon: 2 }, fakeFetch({}, 503))).rejects.toThrow("503");
    await expect(fetchTodayTemps({ lat: 1, lon: 2 }, fakeFetch({ daily: {} }))).rejects.toThrow();
  });
});
