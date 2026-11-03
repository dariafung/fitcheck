// Every stored item photo is framed the same way: the garment centered on a
// white 4:5 canvas with the same margin all round, so tiles across the app
// line up whatever the store's own framing was.
import sharp from "sharp";

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 1600;
// Share of the canvas width / height left empty on each side.
export const MARGIN = 0.1;
// How far below 255 any channel must be for a pixel to count as garment
// rather than white background (AI cut-outs sometimes leave a faint shadow).
export const TRIM_THRESHOLD = 12;
// A row or column needs at least this share of garment pixels to count, so
// a stray speck or JPEG noise near the edge doesn't widen the frame.
export const MIN_LINE_SHARE = 0.002;

const WHITE = { r: 255, g: 255, b: 255 };

interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

function isGarment(data: Buffer, i: number): boolean {
  const limit = 255 - TRIM_THRESHOLD;
  return data[i] < limit || data[i + 1] < limit || data[i + 2] < limit;
}

// Rows and columns with enough garment pixels inside `area`, as bounds.
function lineBounds(data: Buffer, width: number, area: Bounds): Bounds | null {
  const rows = new Uint32Array(area.height);
  const columns = new Uint32Array(area.width);
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      if (isGarment(data, ((area.top + y) * width + area.left + x) * 3)) {
        rows[y]++;
        columns[x]++;
      }
    }
  }
  const minRow = Math.max(1, Math.round(area.width * MIN_LINE_SHARE));
  const minColumn = Math.max(1, Math.round(area.height * MIN_LINE_SHARE));
  const top = rows.findIndex((n) => n >= minRow);
  const left = columns.findIndex((n) => n >= minColumn);
  if (top < 0 || left < 0) return null;
  const bottom = rows.findLastIndex((n) => n >= minRow);
  const right = columns.findLastIndex((n) => n >= minColumn);
  return { left: area.left + left, top: area.top + top, width: right - left + 1, height: bottom - top + 1 };
}

// Pieces are found on a grid of cells about this many across the long side.
const PIECE_GRID = 400;
// A piece counts as garment when it has at least this share of the biggest
// piece's pixels: both shoes of a pair stay, the product name, a badge or
// the edge of a thumbnail next to the photo don't.
export const MIN_PIECE_SHARE = 0.25;

// The area covered by the garment: the biggest piece of non-white pixels and
// any piece nearly as big, leaving out small ones elsewhere in the crop.
function garmentArea(data: Buffer, width: number, height: number): Bounds | null {
  const cell = Math.max(1, Math.ceil(Math.max(width, height) / PIECE_GRID));
  const cols = Math.ceil(width / cell);
  const rowsN = Math.ceil(height / cell);
  const weight = new Uint32Array(cols * rowsN);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isGarment(data, (y * width + x) * 3)) weight[Math.floor(y / cell) * cols + Math.floor(x / cell)]++;
    }
  }
  // Neighbouring cells, and cells one apart (a thin gap), join one piece.
  const label = new Int32Array(cols * rowsN).fill(-1);
  const pieces: { pixels: number; left: number; top: number; right: number; bottom: number }[] = [];
  const stack: number[] = [];
  for (let start = 0; start < weight.length; start++) {
    if (weight[start] === 0 || label[start] >= 0) continue;
    const piece = { pixels: 0, left: cols, top: rowsN, right: -1, bottom: -1 };
    label[start] = pieces.length;
    stack.push(start);
    while (stack.length > 0) {
      const at = stack.pop()!;
      const cx = at % cols;
      const cy = (at - cx) / cols;
      piece.pixels += weight[at];
      piece.left = Math.min(piece.left, cx);
      piece.right = Math.max(piece.right, cx);
      piece.top = Math.min(piece.top, cy);
      piece.bottom = Math.max(piece.bottom, cy);
      for (let ny = Math.max(0, cy - 2); ny <= Math.min(rowsN - 1, cy + 2); ny++) {
        for (let nx = Math.max(0, cx - 2); nx <= Math.min(cols - 1, cx + 2); nx++) {
          const next = ny * cols + nx;
          if (weight[next] > 0 && label[next] < 0) {
            label[next] = pieces.length;
            stack.push(next);
          }
        }
      }
    }
    pieces.push(piece);
  }
  if (pieces.length === 0) return null;
  const biggest = Math.max(...pieces.map((p) => p.pixels));
  const kept = pieces.filter((p) => p.pixels >= biggest * MIN_PIECE_SHARE);
  const left = Math.min(...kept.map((p) => p.left)) * cell;
  const top = Math.min(...kept.map((p) => p.top)) * cell;
  const right = Math.min(width, (Math.max(...kept.map((p) => p.right)) + 1) * cell);
  const bottom = Math.min(height, (Math.max(...kept.map((p) => p.bottom)) + 1) * cell);
  return { left, top, width: right - left, height: bottom - top };
}

function contentBounds(data: Buffer, width: number, height: number): Bounds | null {
  const area = garmentArea(data, width, height);
  return area && lineBounds(data, width, area);
}

// The photo flattened onto white, trimmed to the garment and scaled (up or
// down) until it touches the margin on two sides, centered on the canvas.
// A photo that is all white is placed whole.
export async function frameOnWhite(photo: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(photo)
    .rotate()
    .flatten({ background: WHITE })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const raw = { raw: { width: info.width, height: info.height, channels: 3 as const } };
  const bounds = contentBounds(data, info.width, info.height) ?? {
    left: 0,
    top: 0,
    width: info.width,
    height: info.height,
  };
  const { data: garment, info: fitted } = await sharp(data, raw)
    .extract(bounds)
    .resize(
      Math.round(CANVAS_WIDTH * (1 - 2 * MARGIN)),
      Math.round(CANVAS_HEIGHT * (1 - 2 * MARGIN)),
      { fit: "inside" },
    )
    .png()
    .toBuffer({ resolveWithObject: true });
  return sharp({ create: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, channels: 3, background: WHITE } })
    .composite([
      {
        input: garment,
        left: Math.round((CANVAS_WIDTH - fitted.width) / 2),
        top: Math.round((CANVAS_HEIGHT - fitted.height) / 2),
      },
    ])
    .webp({ quality: 82 })
    .toBuffer();
}

// Lifting a background darker than this to white would wash the garment out.
export const MIN_LIFT_LEVEL = 215;
// How much darker (per channel) than the background a backdrop pixel may be.
export const EDGE_TOLERANCE = 10;
// Share of each side of the backdrop that must be backdrop-coloured: a
// garment cropped at the edge or a pale garment on white touches the sides
// only here and there.
export const MIN_BACKDROP_SIDE = 0.8;
// Sides of that area a backdrop that can't be lifted must fill for the
// photo to go to the model instead. Two, because a gradient backdrop often
// fades to white on the other two.
export const MIN_FILLED_SIDES = 2;
// Share of a row or column that must be shaded to be inside the backdrop.
const MIN_BACKDROP_LINE = 0.05;
// Pixels this light are white already (the store page around the photo).
const WHITE_LEVEL = 253;
const PROBE_SIDE = 256;

// The value a quarter of the way up: the backdrop's own shade when part of
// its edge is lighter.
function lowerQuartile(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 4)];
}

// The pixels along each side (top, bottom, left, right) of the area inside
// whatever white surrounds the photo: store photos are often cropped with a
// strip of the white page around them. Null when the photo is all white.
async function backdropSides(photo: Buffer): Promise<number[][][] | null> {
  const { data, info } = await sharp(photo)
    .rotate()
    .flatten({ background: WHITE })
    .resize(PROBE_SIDE, PROBE_SIDE, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const pixel = (x: number, y: number) => {
    const i = (y * width + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // Rows and columns with a fair share of shading, so JPEG noise on the
  // white page doesn't count.
  const rows = new Uint32Array(height);
  const columns = new Uint32Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!shaded(pixel(x, y))) continue;
      rows[y]++;
      columns[x]++;
    }
  }
  const top = rows.findIndex((n) => n >= width * MIN_BACKDROP_LINE);
  const bottom = rows.findLastIndex((n) => n >= width * MIN_BACKDROP_LINE);
  const left = columns.findIndex((n) => n >= height * MIN_BACKDROP_LINE);
  const right = columns.findLastIndex((n) => n >= height * MIN_BACKDROP_LINE);
  if (top < 0 || left < 0 || right - left < 2 || bottom - top < 2) return null;

  const sides: number[][][] = [[], [], [], []];
  for (let x = left; x <= right; x++) {
    sides[0].push(pixel(x, top));
    sides[1].push(pixel(x, bottom));
  }
  for (let y = top; y <= bottom; y++) {
    sides[2].push(pixel(left, y));
    sides[3].push(pixel(right, y));
  }
  return sides;
}

function shaded(p: number[]): boolean {
  return Math.min(...p) < WHITE_LEVEL;
}

// The colour of a plain light backdrop behind the garment (studio grey,
// off-white), or null when there is none: the photo is on white already, or
// the backdrop is busy, dark or uneven.
function liftableBackground(sides: number[][][]): [number, number, number] | null {
  const edge = sides.flat().filter(shaded);
  const background = [0, 1, 2].map((c) => lowerQuartile(edge.map((p) => p[c]))) as [number, number, number];
  if (Math.min(...background) < MIN_LIFT_LEVEL) return null;
  const backdrop = (p: number[]) => shaded(p) && p.every((v, c) => v >= background[c] - EDGE_TOLERANCE);
  const plain = sides.every((side) => side.filter(backdrop).length >= side.length * MIN_BACKDROP_SIDE);
  return plain ? background : null;
}

// True when a flat-lay photo can't be put on white for free: a backdrop
// (gradient, busy, dark) still fills whole sides of the area, where a
// garment on white touches its bounding box only here and there.
export async function needsCutout(photo: Buffer): Promise<boolean> {
  const sides = await backdropSides(photo);
  if (!sides || liftableBackground(sides)) return false;
  const filled = sides.filter((side) => side.filter(shaded).length >= side.length * MIN_BACKDROP_SIDE);
  return filled.length >= MIN_FILLED_SIDES;
}

// The store's own photo, framed like a cut-out. A plain light background
// (studio grey, off-white) is lifted to white by brightening the whole photo
// in proportion, for free: nothing is cut away, so a white or pale garment
// stays whole, only a few percent lighter. Anything else (a model, a busy or
// dark background) keeps its background.
export async function frameOriginal(photo: Buffer): Promise<Buffer> {
  const sides = await backdropSides(photo);
  const background = sides && liftableBackground(sides);
  if (!background) return frameOnWhite(photo);
  const lifted = await sharp(photo)
    .rotate()
    .flatten({ background: WHITE })
    .linear(
      background.map((v) => 255 / v),
      [0, 0, 0],
    )
    .png()
    .toBuffer();
  return frameOnWhite(lifted);
}
