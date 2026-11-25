// Size advice for a piece someone might buy, from how the sizes they already
// own turned out. Kept apart by brand and by type: a brand's tops say nothing
// about its bottoms or jackets. No size charts: they are often wrong. Only
// code picks words here, and with nothing to go on it says so.
import type { Category, ItemTags } from "../ai/schemas/common";
import type { ShopperFit } from "../ai/schemas/extract-item";
import { CATEGORY_PLURALS } from "../check/reasons";
import { brandGroup } from "../entry/brands";
import type { SizeFit } from "./fit";
import { rankSize, type RankedSize, type Scale } from "./rank";

// An owned piece with a size and a word on how it fit, whatever its status.
export interface WornSize {
  brand: string | null;
  category: string;
  size: string;
  sizeFit: SizeFit;
}

export interface UsualSizes {
  top: string | null;
  bottom: string | null;
  shoe: string | null;
}

// What the product page showed, besides the tags.
export interface PageSizing {
  brand?: string;
  // The size picked on the page.
  size?: string;
  // What shoppers say about the fit, if the screenshot shows any of it.
  shopperFit?: ShopperFit;
}

export interface SizeAdvice {
  // "fits" and "avoid" name sizes; "mixed" found the history at odds with
  // itself; with no history, "shoppers" goes by the page's shoppers and
  // "unknown" has nothing.
  kind: "fits" | "avoid" | "mixed" | "shoppers" | "unknown";
  text: string;
  notes: string[];
}

interface SizeHistory {
  size: RankedSize;
  fits: Set<SizeFit>;
}

function list(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

const basedOn = (n: number) => `Based on ${n} ${n === 1 ? "piece" : "pieces"} you marked.`;

// The scale to advise in: the picked size's when it has history, else the
// one with the most pieces (first in the closet on a tie).
function pickScale(sizes: RankedSize[], picked: RankedSize | null): Scale {
  if (picked && sizes.some((s) => s.scale === picked.scale)) return picked.scale;
  const counts = new Map<Scale, number>();
  for (const s of sizes) counts.set(s.scale, (counts.get(s.scale) ?? 0) + 1);
  return [...counts.entries()].sort(([, a], [, b]) => b - a)[0][0];
}

// Within a ranked scale, too small < just right < too big must hold. Sizes
// that can't be ranked only clash when one size got two answers.
function isMixed(history: SizeHistory[]): boolean {
  if (history.some((h) => h.fits.size > 1)) return true;
  const order: SizeFit[] = ["small", "right", "large"];
  return history.some((a) =>
    history.some((b) => {
      if (a.size.rank === null || b.size.rank === null || a.size.rank >= b.size.rank) return false;
      const [fitA] = a.fits;
      const [fitB] = b.fits;
      return order.indexOf(fitA) > order.indexOf(fitB);
    }),
  );
}

const STRETCH = /elastane|spandex|lycra|elastomultiester|stretch/i;

// Said only beside "too small", and only when fabrics were read at all.
function noStretch(tags: ItemTags): boolean {
  return tags.materials.length > 0 && !tags.materials.some((m) => STRETCH.test(m));
}

function usualSize(category: Category, usual: UsualSizes): string | null {
  // The profile's top size is for tops and dresses; it has none for jackets.
  if (category === "top" || category === "one_piece") return usual.top;
  if (category === "bottom") return usual.bottom;
  if (category === "shoes" && usual.shoe) {
    return `${usual.shoe[0] === "M" ? "men's" : "women's"} ${usual.shoe.slice(1)}`;
  }
  return null;
}

function headline(history: SizeHistory[], picked: RankedSize | null, where: string): Pick<SizeAdvice, "kind" | "text"> {
  const labels = (fit: SizeFit) =>
    history
      .filter((h) => h.fits.has(fit))
      .sort((a, b) => (a.size.rank ?? 0) - (b.size.rank ?? 0))
      .map((h) => h.size.label);
  const [small, right, large] = [labels("small"), labels("right"), labels("large")];
  if (isMixed(history)) {
    const said = [
      ...(small.length ? [`${list(small)} too small`] : []),
      ...(right.length ? [`${list(right)} just right`] : []),
      ...(large.length ? [`${list(large)} too big`] : []),
    ];
    return { kind: "mixed", text: `Sizes vary for you in ${where}: ${list(said)}. No safe pick.` };
  }
  const known = picked && history.some((h) => h.size.scale === picked.scale) ? picked : null;

  if (right.length > 0) {
    const fit = right.length === 1 ? "fits" : "fit";
    if (known && right.includes(known.label)) return { kind: "fits", text: `${known.label} fits you in ${where}.` };
    if (known) {
      return { kind: "fits", text: `You picked ${known.label}, but ${list(right)} ${fit} you in ${where}.` };
    }
    const go = right.length === 1 ? ` Go with ${right[0]}.` : "";
    return { kind: "fits", text: `${list(right)} ${fit} you in ${where}.${go}` };
  }

  const parts: string[] = [];
  if (small.length) parts.push(`${list(small)} ${small.length === 1 ? "is" : "are"} too small on you`);
  if (large.length) parts.push(`${list(large)} ${large.length === 1 ? "is" : "are"} too big on you`);
  const pickedNote = known && [...small, ...large].includes(known.label) ? `You picked ${known.label}. ` : "";
  return { kind: "avoid", text: `${pickedNote}${list(parts)} in ${where}. Skip ${list([...small, ...large])}.` };
}

// Shoppers have other bodies, so this says which way to lean, never a size.
const SHOPPERS: Record<ShopperFit["runs"], { text: string; lean: (usual: string) => string }> = {
  small: { text: "Shoppers say it runs small.", lean: (usual) => `You usually wear ${usual}. Consider a size up.` },
  true: { text: "Shoppers say it's true to size.", lean: (usual) => `You usually wear ${usual}.` },
  large: { text: "Shoppers say it runs big.", lean: (usual) => `You usually wear ${usual}. Consider a size down.` },
  mixed: { text: "Shoppers disagree on the size.", lean: (usual) => `You usually wear ${usual}.` },
};

// Null when there is nothing to say at all: no brand read, and no shopper
// feedback on the page.
export function sizeAdvice(
  candidate: { tags: ItemTags; page: PageSizing },
  worn: readonly WornSize[],
  usual: UsualSizes,
): SizeAdvice | null {
  const { tags, page } = candidate;
  const category = tags.category;
  const shoppers = page.shopperFit;
  const quotes = (shoppers?.quotes ?? []).map((q) => `Shopper feedback: “${q}”`);
  const usually = usualSize(category, usual);
  // With no history of their own, the page's shoppers come next.
  const without = (text: string): SizeAdvice => {
    if (!shoppers) return { kind: "unknown", text, notes: usually ? [`You usually wear ${usually}.`] : [] };
    const { text: says, lean } = SHOPPERS[shoppers.runs];
    return { kind: "shoppers", text: says, notes: [...(usually ? [lean(usually)] : []), text, ...quotes] };
  };
  const brand = page.brand?.trim();
  const group = brand ? brandGroup(brand) : "";
  if (!brand || !group) return shoppers ? without("No brand read, so no size history to go on.") : null;

  const where = `${brand} ${CATEGORY_PLURALS[category]}`;
  const picked = page.size ? rankSize(page.size, category) : null;
  const pieces = worn.flatMap((w) => {
    if (!w.brand || w.category !== category || brandGroup(w.brand) !== group) return [];
    const size = rankSize(w.size, category);
    return size ? [{ size, fit: w.sizeFit }] : [];
  });
  if (pieces.length === 0) return without(`No size history with ${where} yet.`);

  const scale = pickScale(pieces.map((p) => p.size), picked);
  const used = pieces.filter((p) => p.size.scale === scale);
  const history = new Map<string, SizeHistory>();
  for (const { size, fit } of used) {
    const entry = history.get(size.label) ?? { size, fits: new Set() };
    entry.fits.add(fit);
    history.set(size.label, entry);
  }
  const head = headline([...history.values()], picked, where);
  const tooSmall = head.kind === "avoid" && used.some((p) => p.fit === "small");
  return {
    ...head,
    notes: [
      basedOn(used.length),
      ...(tooSmall && noStretch(tags) ? ["No stretch fiber listed, so don't count on it giving."] : []),
      ...quotes,
    ],
  };
}
