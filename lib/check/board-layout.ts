// Where each piece sits on an outfit board: a white 4:5 card with every
// piece on its own, none overlapping, staggered like a flat-lay collage.
// Boxes are percentages of the board's width (left, width) and height
// (top, height); each photo is scaled to fit inside its box.
import type { Category } from "../ai/schemas/common";

export interface BoardBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

type Slots = Partial<Record<Category, BoardBox>>;

const box = (left: number, top: number, width: number, height: number): BoardBox => ({ left, top, width, height });

// Top upper left, bottom down the right, shoes lower left.
const SEPARATES: Slots = {
  top: box(4, 4, 46, 46),
  bottom: box(52, 22, 44, 56),
  shoes: box(6, 60, 40, 32),
};

// The layer takes the upper left; top and bottom stack on the right.
const SEPARATES_LAYERED: Slots = {
  outerwear: box(4, 3, 44, 44),
  top: box(52, 3, 44, 38),
  bottom: box(52, 43, 44, 50),
  shoes: box(6, 58, 40, 32),
};

const ONE_PIECE: Slots = {
  one_piece: box(36, 4, 58, 82),
  shoes: box(4, 62, 30, 30),
};

const ONE_PIECE_LAYERED: Slots = {
  outerwear: box(4, 4, 42, 46),
  one_piece: box(50, 4, 46, 80),
  shoes: box(6, 60, 38, 30),
};

function slotsFor(categories: readonly Category[]): Slots {
  const layered = categories.includes("outerwear");
  if (categories.includes("one_piece")) return layered ? ONE_PIECE_LAYERED : ONE_PIECE;
  return layered ? SEPARATES_LAYERED : SEPARATES;
}

// Anything that isn't one outfit's set of slots (a repeated category, an
// accessory) falls back to a plain two-column grid.
function grid(count: number): BoardBox[] {
  const rows = Math.ceil(count / 2);
  const height = 100 / rows;
  return Array.from({ length: count }, (_, i) =>
    box((i % 2) * 50 + 2, Math.floor(i / 2) * height + 2, 46, height - 4),
  );
}

// One box per piece, in the order given.
export function boardLayout(categories: readonly Category[]): BoardBox[] {
  const slots = slotsFor(categories);
  const boxes = categories.map((c) => slots[c]);
  const fits = boxes.every(Boolean) && new Set(categories).size === categories.length;
  return fits ? (boxes as BoardBox[]) : grid(categories.length);
}
