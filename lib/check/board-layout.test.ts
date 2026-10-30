import { describe, expect, it } from "vitest";
import type { Category } from "../ai/schemas/common";
import { boardLayout, type BoardBox } from "./board-layout";

// Every way to build an outfit, in the slot order outfits.ts uses.
const OUTFITS: Category[][] = [
  ["top", "bottom", "shoes"],
  ["top", "bottom", "shoes", "outerwear"],
  ["one_piece", "shoes"],
  ["one_piece", "shoes", "outerwear"],
];

function overlaps(a: BoardBox, b: BoardBox): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}

function expectClean(boxes: BoardBox[]) {
  for (const b of boxes) {
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.top).toBeGreaterThanOrEqual(0);
    expect(b.left + b.width).toBeLessThanOrEqual(100);
    expect(b.top + b.height).toBeLessThanOrEqual(100);
  }
  for (const [i, a] of boxes.entries()) {
    for (const b of boxes.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
  }
}

describe("boardLayout", () => {
  it.each(OUTFITS)("keeps every piece on the board, apart: %s", (...categories) => {
    const boxes = boardLayout(categories);
    expect(boxes).toHaveLength(categories.length);
    expectClean(boxes);
  });

  it("places a piece by its category, whatever the order", () => {
    const [shoes, top] = boardLayout(["shoes", "top", "bottom"]);
    expect(boardLayout(["top", "bottom", "shoes"])).toEqual([top, expect.anything(), shoes]);
  });

  it("falls back to a grid for anything else", () => {
    for (const categories of [["top", "top", "shoes"], ["accessory", "top"], ["top", "bottom", "shoes", "outerwear", "accessory"]] as Category[][]) {
      const boxes = boardLayout(categories);
      expect(boxes).toHaveLength(categories.length);
      expectClean(boxes);
    }
  });
});
