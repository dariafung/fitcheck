// Feeds a real extractItem response (Allbirds product page screenshot, web
// search on, extract-item@4, recorded 2026-10-28; encrypted reasoning
// stripped) through the live parsing, mapping and both validation layers.
// The model wrote two plain-text commentary messages before its JSON.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, expect, it, vi } from "vitest";
import { memoryBudgetStore, setBudgetStore } from "../budget";
import { extractItem } from "../index";

const create = vi.fn();
vi.mock("./client", () => ({ getClient: async () => ({ responses: { create } }) }));

const RAW = JSON.parse(
  readFileSync(path.join(process.cwd(), "fixtures/ai/extractItem-raw/allbirds-tree-runner.json"), "utf8"),
);
const SCREENSHOT = { kind: "inline" as const, mime: "image/jpeg", base64: "AAAA" };
const PAGE = "https://www.allbirds.com/products/mens-tree-runners-jet-black?variant=33179624734800";

beforeEach(() => {
  create.mockReset();
  setBudgetStore(memoryBudgetStore());
});

it("turns the recorded Allbirds answer into a valid item in one call", async () => {
  create.mockResolvedValue(RAW);
  const out = await extractItem(
    { knownFields: {}, images: [], screenshot: SCREENSHOT, allowWebSearch: true },
    { mode: "live", record: false },
  );
  expect(create).toHaveBeenCalledTimes(1);
  expect(out).toMatchObject({
    recognized: true,
    title: "Men's Tree Runner",
    brand: "allbirds",
    priceCents: 10000,
    currency: "USD",
    onModel: false,
    tags: { category: "shoes", colorFamily: "black", tempRangeF: { min: 50, max: 85 } },
  });
  // Both sources point at a page the search returned, so both stay.
  expect(out.sources).toEqual([
    { field: "price", url: PAGE },
    { field: "materials", url: PAGE },
  ]);
  // 0-1000 corners (48, 232)-(600, 638) as fractions.
  expect(out.productBox?.x).toBeCloseTo(0.048);
  expect(out.productBox?.y).toBeCloseTo(0.232);
  expect(out.productBox?.width).toBeCloseTo(0.552);
  expect(out.productBox?.height).toBeCloseTo(0.406);
});
