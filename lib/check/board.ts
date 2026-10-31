// Cuts a product photo out of its plain light background, for the outfit
// board, for free: no model call. Most store photos are flat-lays or ghost
// mannequins on white or light grey; anything else (on a model, a busy or
// dark background) is left for the page to show as it is.
import sharp from "sharp";

// Longest side of a cut-out; a board slot is shown at most ~300 px wide.
export const CUTOUT_MAX_SIDE = 640;
// How far (per RGB channel) a pixel may be from the background colour and
// still count as background.
export const BACKGROUND_TOLERANCE = 18;
// Every channel of the background must be at least this light.
export const MIN_BACKGROUND_LEVEL = 200;
// Share of edge pixels that must match the background colour.
export const MIN_PLAIN_EDGE = 0.9;
// Below this share of pixels left, the cut ate the item (say, a white shirt
// on white): give up and show the photo as it is.
export const MIN_KEPT = 0.04;
// Separate specks smaller than this share of the biggest piece (a store's
// "NEW" badge, a watermark) are cleared too.
export const MIN_PIECE_SHARE = 0.05;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function edgeIndexes(width: number, height: number): number[] {
  const indexes: number[] = [];
  for (let x = 0; x < width; x++) indexes.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) indexes.push(y * width, y * width + width - 1);
  return indexes;
}

// Groups what's left into connected pieces and clears the small ones.
function clearSpecks(cleared: Uint8Array, width: number, height: number): void {
  const piece = new Int32Array(width * height).fill(-1);
  const sizes: number[] = [];
  const queue = new Int32Array(width * height);
  for (let start = 0; start < width * height; start++) {
    if (cleared[start] || piece[start] >= 0) continue;
    const id = sizes.length;
    let head = 0;
    let tail = 0;
    piece[start] = id;
    queue[tail++] = start;
    while (head < tail) {
      const i = queue[head++];
      const x = i % width;
      for (const next of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
        if (next < 0 || next >= width * height || cleared[next] || piece[next] >= 0) continue;
        piece[next] = id;
        queue[tail++] = next;
      }
    }
    sizes.push(tail);
  }
  const biggest = Math.max(0, ...sizes);
  for (let i = 0; i < width * height; i++) {
    if (piece[i] >= 0 && sizes[piece[i]] < biggest * MIN_PIECE_SHARE) cleared[i] = 1;
  }
}

// A WebP with the background made transparent and trimmed away, or null when
// the background isn't plain and light enough to remove this way.
export async function cutOut(photo: Buffer): Promise<Buffer | null> {
  const { data, info } = await sharp(photo)
    .rotate()
    .resize(CUTOUT_MAX_SIDE, CUTOUT_MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    // A photo that is already transparent sits on white like the board.
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const rgb = (i: number, c: number) => data[i * 3 + c];

  const edges = edgeIndexes(width, height);
  const background = [0, 1, 2].map((c) => median(edges.map((i) => rgb(i, c))));
  if (Math.min(...background) < MIN_BACKGROUND_LEVEL) return null;
  const [br, bg, bb] = background;
  const distance = (i: number) =>
    Math.max(Math.abs(data[i * 3] - br), Math.abs(data[i * 3 + 1] - bg), Math.abs(data[i * 3 + 2] - bb));
  const plainEdges = edges.filter((i) => distance(i) <= BACKGROUND_TOLERANCE);
  if (plainEdges.length < edges.length * MIN_PLAIN_EDGE) return null;

  // Flood in from the edges through background-coloured pixels only, so
  // light parts inside the item stay.
  const cleared = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  for (const i of plainEdges) {
    if (!cleared[i]) {
      cleared[i] = 1;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % width;
    for (const next of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
      if (next < 0 || next >= width * height || cleared[next]) continue;
      if (distance(next) > BACKGROUND_TOLERANCE) continue;
      cleared[next] = 1;
      queue[tail++] = next;
    }
  }
  clearSpecks(cleared, width, height);
  const kept = cleared.reduce((n, c) => n + (c ? 0 : 1), 0);
  if (kept < width * height * MIN_KEPT) return null;

  // Pixels next to the cleared area fade with how close they are to the
  // background, so the edge isn't jagged.
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    for (let c = 0; c < 3; c++) rgba[i * 4 + c] = rgb(i, c);
    let alpha = 255;
    if (cleared[i]) {
      alpha = 0;
    } else {
      const x = i % width;
      const touches =
        (x > 0 && cleared[i - 1]) || (x < width - 1 && cleared[i + 1]) || cleared[i - width] || cleared[i + width];
      if (touches) {
        const d = distance(i) - BACKGROUND_TOLERANCE;
        alpha = Math.max(0, Math.min(255, Math.round((d / BACKGROUND_TOLERANCE) * 255)));
      }
    }
    rgba[i * 4 + 3] = alpha;
  }

  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .trim()
    .webp({ quality: 82, alphaQuality: 90 })
    .toBuffer();
}
